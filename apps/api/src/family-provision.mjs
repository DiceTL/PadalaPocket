import { Account, Asset, Contract, Keypair, Networks, Operation, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';
import { NoirAgentClient, toCall } from '@noirx402/agent-sdk';
import { dispatchMoneyStep } from './money-dispatch.mjs';
import { reconcileMoneyStep } from './money-recovery.mjs';
import { signFamilyTransaction } from './family-custody.mjs';
import { readFamilyRules } from './family.mjs';
import { phpToStroops } from './money-mapping.mjs';
import { bucketDevice } from './weekly-plan.mjs';

const roles = ['parent', 'student', 'agent'];
const buckets = [['needs', 'Needs'], ['wants', 'Wants'], ['savings', 'Savings'], ['my_money', 'My Money']];
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
const fail = (code, status = 409) => Object.assign(Error(code), { code, status });
const budget = () => fail('PROVISION_BUDGET');
const evidence = () => fail('PROVISION_EVIDENCE_MISMATCH');
const token = Asset.native().contractId(Networks.TESTNET);
const units = value => {
  if (typeof value !== 'string' || !/^[1-9][0-9]{0,18}$/.test(value)) throw budget();
  return BigInt(value);
};
const nativeUnits = value => {
  if (typeof value !== 'string' || !/^\d+\.\d{7}$/.test(value)) throw evidence();
  return BigInt(value.replace('.', ''));
};
const formatXlm = n => `${n / 10000000n}.${String(n % 10000000n).padStart(7, '0')}`;

function spendable(snapshot, address, reserve) {
  if (snapshot?.account_id !== address || snapshot.signers?.length !== 1 || snapshot.signers[0].key !== address
    || snapshot.signers[0].type !== 'ed25519_public_key' || snapshot.signers[0].weight !== 1
    || !['low_threshold','med_threshold','high_threshold'].every(key => [0, 1].includes(snapshot.thresholds?.[key]))) throw evidence();
  const counts = [snapshot.subentry_count, snapshot.num_sponsoring, snapshot.num_sponsored];
  if (!counts.every(value => Number.isSafeInteger(value) && value >= 0)) throw evidence();
  const required = 2n + BigInt(counts[0]) + BigInt(counts[1]) - BigInt(counts[2]);
  if (required < 2n) throw evidence();
  const native = snapshot.balances?.find(value => value.asset_type === 'native');
  return nativeUnits(native?.balance) - nativeUnits(native?.selling_liabilities) - required * reserve;
}
async function horizon(path, allowMissing = false) {
  try {
    const response = await fetch(`https://horizon-testnet.stellar.org${path}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
    if (allowMissing && response.status === 404) return null;
    if (!response.ok) throw Error();
    return await response.json();
  } catch { throw fail('PROVISION_UNAVAILABLE', 503); }
}
async function call(client, sql, values) {
  try { return (await client.query(sql, values)).rows[0].value; }
  catch (error) {
    if (error.message === 'PROVISION_FORBIDDEN') throw fail(error.message, 403);
    if (['PROVISION_CONFLICT', 'FAMILY_CAPACITY_FULL'].includes(error.message)) throw fail(error.message);
    throw fail('PROVISION_UNAVAILABLE', 503);
  }
}

// Operator-only. Supply a dedicated approved project signer and independently scoped SQL clients.
// Do not wire this to an HTTP route or enable wallet_ready while requests still use legacy demo signers.
export async function provisionFamily({ custody, signing, journal, feeSigner, server,
  account = address => horizon(`/accounts/${address}`, true),
  baseReserve = async () => BigInt((await horizon('/ledgers?order=desc&limit=1'))._embedded.records[0].base_reserve_in_stroops),
  noir = new NoirAgentClient({ network: 'testnet' }), now = Date.now,
}, { member, terms, renewal }) {
  if (!uuid.test(member?.family_id ?? '') || !uuid.test(member?.user_id ?? '') || !uuid.test(terms?.requestKey ?? '')) throw fail('INVALID_INPUT', 400);
  const source = feeSigner.publicKey(), family = member.family_id;
  Keypair.fromPublicKey(source);
  if (source !== terms.feeSource) throw budget();
  const reserve = units(terms.baseReserveStroops), float = units(terms.operatingFloatStroops);
  const nativeFee = units(terms.accountFeePerOpStroops), noirFee = units(terms.noirFeeCapStroops);
  const maxFee = units(terms.maxFeeStroops), cap = units(terms.policyCapStroops);
  const expires = new Date(terms.policyExpiresAt);
  const starts = { parent: 2n * reserve + float + noirFee * 5n, student: 2n * reserve + float + noirFee, agent: 2n * reserve + float };
  const total = starts.parent + starts.student + starts.agent;
  if (total > units(terms.maxOperatingTransferStroops) || total > 9223372036854775807n
    || nativeFee * 3n > 4294967295n || noirFee > 4294967295n || nativeFee * 3n + noirFee * 6n > maxFee
    || !Number.isFinite(expires.getTime()) || expires.getTime() % 1000 !== 0) throw budget();
  const validateLive = async deadline => {
    if (deadline <= now() || deadline > now() + 86400000 || await baseReserve() !== reserve) throw budget();
    const rules = await readFamilyRules(journal, family);
    if (cap > BigInt(phpToStroops(rules.settings.capMinor)) || deadline <= now()) throw budget();
  };
  const frozen = {
    baseReserveStroops: String(reserve), operatingFloatStroops: String(float),
    maxOperatingTransferStroops: terms.maxOperatingTransferStroops, accountFeePerOpStroops: String(nativeFee),
    noirFeeCapStroops: String(noirFee), maxFeeStroops: String(maxFee),
    policyCapStroops: String(cap), policyExpiresAt: expires.toISOString(),
  };
  const begin = candidates => call(custody, 'select wallet_custody.begin_family_provision($1,$2,$3,$4,$5,$6) as value',
    [member.user_id, family, terms.requestKey, source, frozen, candidates && JSON.stringify(candidates)]);
  let record = await begin(null);
  if (!record) {
    if (renewal) throw fail('PROVISION_CONFLICT');
    await validateLive(expires.getTime());
    if (spendable(await account(source), source, reserve) < total + nativeFee * 3n) throw budget();
    record = await begin(roles.map(role => {
      const signer = Keypair.random();
      return { role, address: signer.publicKey(), seed: signer.secret() };
    }));
  }
  const { operationId, accounts } = record;
  const pending = { status: 'pending', operationId, accounts };
  const devices = buckets.map(([key, name]) => {
    const role = key === 'my_money' ? 'student' : 'parent';
    const routine = key === 'needs' || key === 'wants';
    return { key, role, routine, target: bucketDevice(family, name), agent: accounts[routine ? 'agent' : role] };
  });
  const policies = devices.filter(device => device.routine);
  const policySteps = policies.flatMap(device => [`${device.key}_revoke`, `${device.key}_policy`]);
  const policyRecord = (previous = null, request = null, approved = null) => call(custody,
    'select wallet_custody.family_provision_policy($1,$2,$3,$4,$5,$6) as value',
    [member.user_id, family, operationId, previous, request, approved]);
  let policy = await policyRecord();
  let deadline = Date.parse(policy.terms.policyExpiresAt);
  const observe = (id, stepKey) => reconcileMoneyStep(journal, { operationId: id, familyId: family, stepKey }, { server });
  if (deadline <= now()) {
    let inFlight = false;
    for (const key of ['accounts', ...devices.map(d => `${d.key}_device`)]) {
      const state = await observe(operationId, key);
      if (state.phase === 'dispatching' && state.outcome !== 'confirmed') inFlight = true;
    }
    for (const key of policySteps) {
      const state = await observe(policy.operationId, key);
      if (state.phase === 'dispatching' && state.outcome !== 'confirmed') inFlight = true;
    }
    if (inFlight) return pending;
    if (!renewal) return { ...pending, status: 'policy_renewal_required' };
    const next = Date.parse(renewal.policyExpiresAt);
    if (!uuid.test(renewal.requestKey ?? '') || renewal.requestKey === policy.requestKey
      || !Number.isFinite(next) || next % 1000 !== 0 || units(renewal.maxFeeStroops) < 4n * noirFee) throw budget();
    await validateLive(next);
    for (const key of policySteps) {
      const { data, error } = await journal.rpc('retire_unsent_provision_policy', {
        p_operation: policy.operationId, p_family: family, p_step_key: key, p_source: accounts.parent,
      });
      if (error) throw fail('PROVISION_UNAVAILABLE', 503);
      if (!data) return pending;
    }
    policy = await policyRecord(policy.operationId, renewal.requestKey,
      { policyExpiresAt: new Date(next).toISOString(), maxFeeStroops: renewal.maxFeeStroops });
    deadline = Date.parse(policy.terms.policyExpiresAt);
  } else if (renewal && (policy.operationId === operationId || renewal.requestKey !== policy.requestKey
    || Date.parse(renewal.policyExpiresAt) !== deadline || renewal.maxFeeStroops !== policy.terms.maxFeeStroops)) {
    throw fail('PROVISION_CONFLICT');
  }
  const dispatch = (id, stepKey, sourceAccount, prepare) => dispatchMoneyStep(journal,
    { operationId: id, familyId: family, stepKey, sourceAccount },
    { prepare, server, now, recoverPreparation: true, beforeSend: () => validateLive(deadline) });
  const created = await dispatch(operationId, 'accounts', source, async () => {
    await validateLive(deadline);
    const snapshot = await account(source);
    if (spendable(snapshot, source, reserve) < total + nativeFee * 3n) throw budget();
    const builder = new TransactionBuilder(new Account(source, snapshot.sequence), { fee: String(nativeFee), networkPassphrase: Networks.TESTNET,
      timebounds: { minTime: 0, maxTime: Math.floor(now() / 1000) + 120 } });
    for (const role of roles) builder.addOperation(Operation.createAccount({ destination: accounts[role], startingBalance: formatXlm(starts[role]) }));
    const transaction = builder.build();
    transaction.sign(feeSigner);
    return transaction.toXDR();
  });
  if (created.phase !== 'confirmed') return pending;

  const steps = devices.map(d => [operationId, d, `${d.key}_device`, { kind: 'registerDevice', deviceHash: d.target, agent: d.agent }]);
  for (const d of policies) {
    if (policy.operationId !== operationId) {
      const revokeKey = `${d.key}_revoke`;
      const revoke = await observe(policy.operationId, revokeKey);
      if (revoke.phase !== 'unstarted') {
        steps.push([policy.operationId, d, revokeKey, { kind: 'revokeAgent', deviceHash: d.target }]);
      } else if ((await observe(policy.operationId, `${d.key}_policy`)).phase === 'unstarted') {
        const previous = await noir.getPolicy(d.target);
        if (previous) {
          if (previous.agent !== d.agent || previous.asset !== token || previous.maxAmount !== cap
            || !(previous.expiresAt?.getTime() < now()) || await noir.getDeviceOwner(d.target) !== accounts.parent) throw evidence();
          steps.push([policy.operationId, d, revokeKey, { kind: 'revokeAgent', deviceHash: d.target }]);
        }
      }
    }
    steps.push([policy.operationId, d, `${d.key}_policy`, { kind: 'registerAgent', deviceHash: d.target, agent: d.agent,
      asset: token, maxAmount: cap, expiresAt: new Date(deadline) }]);
  }
  for (const [id, device, step, operation] of steps) {
    const address = accounts[device.role];
    const state = await dispatch(id, step, address, async () => {
      await validateLive(deadline);
      if (spendable(await account(address), address, reserve) < float + noirFee) throw budget();
      const unsigned = await noir.prepare(address, operation);
      const tx = TransactionBuilder.fromXDR(unsigned, Networks.TESTNET);
      const { contract, method, args } = toCall(address, operation);
      const expected = new Contract(noir.contracts[contract]).call(method, ...args).body().invokeHostFunctionOp().hostFunction();
      if (!(tx instanceof Transaction) || tx.source !== address || tx.operations.length !== 1) throw evidence();
      const [op] = tx.operations;
      if (op.type !== 'invokeHostFunction' || op.source !== undefined || !op.func.toXDR().equals(expected.toXDR())) throw evidence();
      if (BigInt(tx.fee) > noirFee) throw budget();
      return signFamilyTransaction(signing, { member, unsigned,
        wallet: { familyId: family, role: device.role, publicAddress: address, network: 'testnet', version: 1 } });
    });
    if (state.phase !== 'confirmed') return pending;
  }

  for (const role of roles) if (spendable(await account(accounts[role]), accounts[role], reserve) < float) throw evidence();
  for (const device of devices) {
    const [owner, agent, policy, amount] = await Promise.all([noir.getDeviceOwner(device.target), noir.getDeviceAgent(device.target),
      noir.getPolicy(device.target), noir.getEscrowBalance(device.target)]);
    if (owner !== accounts[device.role] || agent !== device.agent || amount !== 0n) throw evidence();
    if (device.routine ? !policy || policy.agent !== device.agent || policy.asset !== token || policy.maxAmount !== cap
      || policy.expiresAt?.getTime() !== deadline : policy !== null) throw evidence();
  }
  if (deadline <= now()) return { ...pending, status: 'policy_renewal_required' };
  if (await call(custody, 'select wallet_custody.finish_family_provision($1,$2,$3) as value', [member.user_id, family, policy.operationId]) !== true) throw evidence();
  return { ...pending, status: 'confirmed' };
}
