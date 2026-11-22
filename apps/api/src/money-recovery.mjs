import { Keypair, Networks, Transaction, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';

const fail = (status, code) => Object.assign(Error(code), { status, code });
async function call(db, name, args) {
  let response;
  try { response = await db.rpc(name, args); } catch { throw fail(503, 'PROVIDER_UNAVAILABLE'); }
  if (!response.error) return response.data;
  if (response.error.message === 'FORBIDDEN') throw fail(403, 'FORBIDDEN');
  if (response.error.message === 'INVALID_INPUT' || response.error.code === '22P02') throw fail(400, 'INVALID_INPUT');
  throw fail(503, 'PROVIDER_UNAVAILABLE');
}
function outcome(state, status, reason = null) {
  return { operationId: state.operationId, stepKey: state.stepKey, phase: state.phase,
    outcome: status, reason, transactionHash: state.transactionHash ?? null, confirmedLedger: status === 'confirmed' ? state.confirmedLedger : null };
}
function savedTransaction(state) {
  if (state.network !== 'testnet' || typeof state.signedEnvelope !== 'string' || state.signedEnvelope.length > 1048576) throw Error();
  const tx = TransactionBuilder.fromXDR(state.signedEnvelope, Networks.TESTNET);
  if (!(tx instanceof Transaction) || tx.source !== state.sourceAccount || BigInt(tx.sequence) <= 0n
    || tx.hash().toString('hex') !== state.transactionHash || tx.toXDR() !== state.signedEnvelope
    || !tx.signatures.some(signature => Keypair.fromPublicKey(state.sourceAccount).verify(tx.hash(), signature.signature()))
    || !tx.timeBounds || BigInt(tx.timeBounds.maxTime) <= BigInt(tx.timeBounds.minTime)) throw Error();
  // Do not apply today's expiry to historical confirmations of an already admitted transaction.
  return tx;
}
function successfulResult(result, tx) {
  const body = result.result();
  if (body.switch().name !== 'txSuccess') return false;
  const results = body.results();
  return results.length === tx.operations.length && results.every((item, index) => item.switch().name === 'opInner'
    && item.tr().switch().name === tx.operations[index].type && item.tr().value().switch().value === 0);
}

// Deliberately separate from dispatch: no preparation callback, send method or claim authority.
export async function reconcileMoneyStep(db, input, { server } = {}) {
  const identity = { p_operation: input?.operationId, p_family: input?.familyId, p_step_key: input?.stepKey };
  const state = await call(db, 'read_money_recovery', identity);
  const fenced = reason => outcome(state, 'fenced', reason);
  if (!state.reservationState) return fenced('RESERVATION_MISSING');
  if (state.phase === 'unstarted') return fenced('NO_DISPATCH_RECORD');
  if (state.phase === 'unmanaged') return fenced('UNCOORDINATED_STEP');
  if (state.phase === 'preparing') return fenced('PREPARATION_UNRESOLVED');
  if (state.phase === 'prepared') return fenced('NOT_DISPATCHED');
  if (!['dispatching', 'confirmed'].includes(state.phase)) return fenced('UNSUPPORTED_STATE');
  let tx;
  try { tx = savedTransaction(state); } catch { return fenced('SAVED_IDENTITY_INVALID'); }
  if (state.phase === 'confirmed') {
    try {
      if (typeof state.confirmedLedger !== 'string' || !/^[1-9][0-9]{0,18}$/.test(state.confirmedLedger)
        || !successfulResult(xdr.TransactionResult.fromXDR(state.confirmedResultXdr, 'base64'), tx)) return fenced('CHECKPOINT_INVALID');
    } catch { return fenced('CHECKPOINT_INVALID'); }
    return outcome(state, 'confirmed');
  }
  if (!state.ownsSource) return fenced('SOURCE_OWNERSHIP_MISMATCH');
  server ??= new rpc.Server('https://soroban-testnet.stellar.org', { timeout: 15000 });
  let observed;
  try { observed = await server.getTransaction(state.transactionHash); } catch { return fenced('EVIDENCE_UNAVAILABLE'); }
  if (observed?.status === 'NOT_FOUND') return fenced('TRANSACTION_NOT_FOUND');
  if (observed?.status !== 'SUCCESS') return fenced('TRANSACTION_UNCONFIRMED');
  let resultXdr;
  try {
    // SDK txHash is an echo; independently verify the returned envelope's identity and exact bytes.
    const confirmed = TransactionBuilder.fromXDR(observed.envelopeXdr, Networks.TESTNET);
    if (confirmed.hash().toString('hex') !== state.transactionHash || confirmed.toXDR() !== state.signedEnvelope
      || !Number.isSafeInteger(observed.ledger) || observed.ledger <= 0 || !successfulResult(observed.resultXdr, tx)) return fenced('EVIDENCE_MISMATCH');
    resultXdr = observed.resultXdr.toXDR('base64');
  } catch { return fenced('EVIDENCE_MISMATCH'); }
  const checkpoint = await call(db, 'confirm_money_dispatch', { ...identity, p_hash: state.transactionHash,
    p_ledger: String(observed.ledger), p_result_xdr: resultXdr });
  return outcome(checkpoint, 'confirmed');
}
