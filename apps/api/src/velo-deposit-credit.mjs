import { Account, Asset, Keypair, Networks, Operation, Transaction, TransactionBuilder } from '@stellar/stellar-sdk';

const fail = (status, code) => Object.assign(Error(code), { status, code });
const admissionErrors = new Map([
  ['INVALID_INPUT', 400], ['FORBIDDEN', 403], ['NOT_FOUND', 404],
  ['DEPOSIT_NOT_VERIFIED', 409], ['DEPOSIT_CANCELLED', 409],
  ['IDEMPOTENCY_CONFLICT', 409], ['TRANSACTION_REUSED', 409],
]);
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const hash = /^[a-f0-9]{64}$/;
const positiveStroops = /^[1-9][0-9]{0,18}$/;

function account(value) {
  try { Keypair.fromPublicKey(value); return true; } catch { return false; }
}
function xlmAmount(value) {
  const amount = BigInt(value);
  return `${amount / 10000000n}.${(amount % 10000000n).toString().padStart(7, '0')}`;
}
function stroops(value) {
  const match = /^(\d+)(?:\.(\d{1,7}))?$/.exec(value ?? '');
  if (!match) return null;
  return BigInt(match[1]) * 10000000n + BigInt((match[2] ?? '').padEnd(7, '0'));
}

// The coordinator adapter calls this before signing, so a bad destination/amount
// cannot be hidden inside an otherwise valid Stellar transaction.
export function assertDepositCreditTransfer(transaction, { sourceAccount, destinationAccount, amountStroops }) {
  const mismatch = () => fail(409, 'TRANSFER_MISMATCH');
  if (!(transaction instanceof Transaction)
    || transaction.networkPassphrase !== Networks.TESTNET
    || transaction.source !== sourceAccount
    || transaction.operations.length !== 1
    || typeof amountStroops !== 'string' || !positiveStroops.test(amountStroops)) throw mismatch();
  const [operation] = transaction.operations;
  if (operation.type !== 'payment'
    || operation.destination !== destinationAccount
    || (operation.source !== undefined && operation.source !== sourceAccount)
    || !Asset.native().equals(operation.asset)
    || stroops(operation.amount) !== BigInt(amountStroops)) throw mismatch();
  return true;
}

export function buildDepositCreditTransfer({ sourceAccount, destinationAccount, amountStroops, sequence, signer, now = Date.now }) {
  if (!account(sourceAccount) || !account(destinationAccount) || sourceAccount === destinationAccount
    || typeof amountStroops !== 'string' || !positiveStroops.test(amountStroops)
    || !/^\d{1,19}$/.test(String(sequence))) throw fail(400, 'INVALID_INPUT');
  if (!signer || signer.publicKey() !== sourceAccount) throw fail(409, 'SIGNING_IDENTITY_MISMATCH');
  const current = Math.floor(now() / 1000);
  if (!Number.isSafeInteger(current) || current < 0) throw fail(400, 'INVALID_INPUT');
  const transaction = new TransactionBuilder(new Account(sourceAccount, String(sequence)), {
    fee: '100', networkPassphrase: Networks.TESTNET, timebounds: { minTime: 0, maxTime: current + 120 },
  }).addOperation(Operation.payment({
    destination: destinationAccount, asset: Asset.native(), amount: xlmAmount(amountStroops),
  })).build();
  assertDepositCreditTransfer(transaction, { sourceAccount, destinationAccount, amountStroops });
  transaction.sign(signer);
  return transaction.toXDR();
}

// Reserve the verified receipt in the T05 journal, then run one T06 payment step.
// The caller supplies the trusted source and destination resolver plus the
// already-authorized dispatcher and signing preparation; keys never arrive here.
export async function creditVeloDeposit(db, {
  depositId, familyId, parentId, sourceAccount, resolveDestination, dispatch, prepare,
}) {
  if (!uuid.test(depositId ?? '') || !uuid.test(familyId ?? '') || !uuid.test(parentId ?? '')
    || !account(sourceAccount) || typeof resolveDestination !== 'function'
    || typeof dispatch !== 'function' || typeof prepare !== 'function') throw fail(400, 'INVALID_INPUT');

  const { data: deposit, error } = await db.rpc('read_velo_deposit_receipt', {
    p_deposit: depositId, p_family: familyId, p_parent: parentId,
  });
  if (error) throw fail(503, 'PROVIDER_UNAVAILABLE');
  if (!deposit) throw fail(404, 'NOT_FOUND');
  // A superseded cancellation (DEC-140) keeps a verified late payment creditable;
  // every other non-none cancellation state still fences the deposit.
  if (deposit.cancelledAt || ['fenced', 'late_paid', 'resolved'].includes(deposit.cancellationState)) {
    throw fail(409, 'DEPOSIT_CANCELLED');
  }
  if (deposit.status !== 'paid' || deposit.verificationStatus !== 'verified'
    || !hash.test(deposit.txHash ?? '') || !account(deposit.payerAddress)
    || !deposit.verifiedAt || !(Number(deposit.verifiedLedger) > 0)
    || !Number.isInteger(deposit.amountMinor)
    || !positiveStroops.test(String(deposit.amountStroops ?? ''))) {
    throw fail(409, 'DEPOSIT_NOT_VERIFIED');
  }

  let resolved;
  try { resolved = await resolveDestination({ familyId, parentId }); }
  catch { throw fail(503, 'DESTINATION_UNAVAILABLE'); }
  const destinationAccount = typeof resolved === 'string' ? resolved : resolved?.address;
  if ((typeof resolved === 'object' && resolved !== null && resolved.network !== undefined && resolved.network !== 'testnet')
    || !account(destinationAccount)) throw fail(409, 'INVALID_DESTINATION');
  if (destinationAccount === sourceAccount) throw fail(409, 'TRANSFER_IDENTITY_MISMATCH');

  const amountStroops = String(deposit.amountStroops);
  // This RPC locks the same deposit row as cancellation and rechecks the
  // verified, uncancelled receipt before admitting the single journal operation.
  const { data: operation, error: admissionError } = await db.rpc('admit_velo_deposit_credit', {
    p_deposit: depositId, p_family: familyId, p_parent: parentId,
    p_source: sourceAccount, p_destination: destinationAccount,
  });
  if (admissionError) {
    if (admissionErrors.has(admissionError.message)) {
      throw fail(admissionErrors.get(admissionError.message), admissionError.message);
    }
    throw fail(503, 'PROVIDER_UNAVAILABLE');
  }
  if (!operation || operation.familyId !== familyId || operation.requestKey !== depositId
    || operation.amountStroops !== amountStroops) {
    throw fail(409, 'DEPOSIT_CREDIT_CONFLICT');
  }

  const state = await dispatch({
    operationId: operation.id, familyId, stepKey: 'credit', sourceAccount,
  }, {
    prepare: () => prepare({ amountStroops, sourceAccount, destinationAccount }),
  });
  if (!state || !['preparing', 'prepared', 'dispatching', 'confirmed', 'busy', 'abandoned'].includes(state.phase)) {
    throw fail(503, 'PROVIDER_UNAVAILABLE');
  }
  return {
    operationId: operation.id,
    status: state.phase,
    confirmed: state.phase === 'confirmed',
    transactionHash: state.transactionHash ?? null,
    confirmedLedger: state.confirmedLedger == null ? null : String(state.confirmedLedger),
    observation: state.observation ?? null,
  };
}
