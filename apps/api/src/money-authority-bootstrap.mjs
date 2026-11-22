import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { admitMoneyOperation } from './money-journal.mjs';
import { dispatchMoneyStep } from './money-dispatch.mjs';

const roles = ['OWNER', 'AGENT', 'MERCHANT', 'STUDENT'];
const reject = () => { throw Object.assign(Error('AUTHORITY_BOOTSTRAP_UNSAFE'), { code: 'AUTHORITY_BOOTSTRAP_UNSAFE', status: 409 }); };
function integer(value) {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value) || BigInt(value) > 9223372036854775807n) reject();
  return BigInt(value);
}
function terms(input) {
  try {
    const source = input.feeSource.signer.publicKey();
    Keypair.fromPublicKey(input.guardAccount);
    if (input.targets.length !== 4 || !input.targets.every((target, index) => target.role === roles[index])) reject();
    const targets = input.targets.map(target => ({ role: target.role, account: target.signer.publicKey() }));
    if (new Set([source, input.guardAccount, ...targets.map(target => target.account)]).size !== 6) reject();
    const reserve = integer(input.baseReserveStroops), fee = integer(input.baseFeeStroops) * 8n;
    if (reserve * 4n > integer(input.maxReserveStroops) || fee > integer(input.maxFeeStroops) || fee > 4294967295n) reject();
    return { source, targets, reserve, fee, payload: { targets, guardAccount: input.guardAccount,
      baseReserveStroops: input.baseReserveStroops, baseFeeStroops: input.baseFeeStroops,
      maxReserveStroops: input.maxReserveStroops, maxFeeStroops: input.maxFeeStroops, funding: 'project_operating' } };
  } catch { reject(); }
}
function originalAuthority({ account, signer }) {
  if (account?.account_id !== signer.publicKey() || account.signers?.length !== 1
    || account.signers[0].key !== account.account_id || account.signers[0].type !== 'ed25519_public_key'
    || account.signers[0].weight !== 1
    || !['low_threshold', 'med_threshold', 'high_threshold'].every(name => [0, 1].includes(account.thresholds?.[name]))) reject();
}
function nativeStroops(value) {
  if (typeof value !== 'string' || !/^(0|[1-9][0-9]*)\.[0-9]{7}$/.test(value)) reject();
  return BigInt(value.replace('.', ''));
}

// No key creation or transport here. Snapshots and budgets must be measured/approved before actual use.
export function buildAuthorityBootstrap(input, { now = Date.now } = {}) {
  try {
    const plan = terms(input);
    for (const entry of [input.feeSource, ...input.targets]) originalAuthority(entry);
    const account = input.feeSource.account;
    const counts = [account.subentry_count, account.num_sponsoring, account.num_sponsored];
    if (!counts.every(value => Number.isSafeInteger(value) && value >= 0)) reject();
    const reserveUnits = 2n + BigInt(counts[0]) + BigInt(counts[1]) - BigInt(counts[2]);
    if (reserveUnits < 2n) reject();
    const native = account.balances.find(balance => balance.asset_type === 'native');
    if (nativeStroops(native.balance) - nativeStroops(native.selling_liabilities)
      - reserveUnits * plan.reserve < plan.reserve * 4n + plan.fee) reject();
    const current = Math.floor(now() / 1000);
    if (!Number.isSafeInteger(current) || current < 0) reject();
    const builder = new TransactionBuilder(new Account(plan.source, account.sequence), {
      fee: input.baseFeeStroops, networkPassphrase: Networks.TESTNET, timebounds: { minTime: 0, maxTime: current + 120 },
    });
    const amount = `${plan.reserve / 10000000n}.${(plan.reserve % 10000000n).toString().padStart(7, '0')}`;
    for (const target of plan.targets) {
      builder.addOperation(Operation.payment({ source: plan.source, destination: target.account, asset: Asset.native(), amount }));
      builder.addOperation(Operation.setOptions({ source: target.account, masterWeight: 1,
        lowThreshold: 2, medThreshold: 2, highThreshold: 2, signer: { ed25519PublicKey: input.guardAccount, weight: 1 } }));
    }
    const tx = builder.build();
    // The new guard is not yet an authorizer; its unused signature would cause txBAD_AUTH_EXTRA.
    tx.sign(input.feeSource.signer, ...input.targets.map(target => target.signer));
    return tx.toXDR();
  } catch { reject(); }
}

// Call only from the isolated operator context after review and exact-operation approval.
export async function dispatchAuthorityBootstrap(database, input, { server, now = Date.now } = {}) {
  const plan = terms(input);
  const operation = await admitMoneyOperation(database, { member: input.member, requestKey: input.requestKey,
    purpose: 'authority_cutover', network: 'testnet', asset: 'native', sourceRef: `project:${plan.source}`,
    destinationRef: `authority:${input.guardAccount}`, amountStroops: (plan.reserve * 4n).toString(), payload: plan.payload });
  const state = await dispatchMoneyStep(database, { operationId: operation.id, familyId: input.member.family_id,
    stepKey: 'authority_cutover', sourceAccount: plan.source }, { server, now, prepare: async () => buildAuthorityBootstrap(input, { now }) });
  return { operationId: operation.id, phase: state.phase, transactionHash: state.transactionHash ?? null };
}
