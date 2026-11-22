import { randomUUID } from 'node:crypto';
import { Keypair, Networks, Transaction, TransactionBuilder, rpc } from '@stellar/stellar-sdk';

const fail = (status, code) => Object.assign(Error(code), { status, code });
const errors = new Map([
  ['INVALID_INPUT', 400], ['FORBIDDEN', 403], ['STALE_WORKER', 409],
  ['DISPATCH_IDENTITY_CONFLICT', 409], ['UNCOORDINATED_STEP', 409],
  ['IDEMPOTENCY_CONFLICT', 409], ['TRANSACTION_REUSED', 409],
]);
async function call(db, name, args) {
  const { data, error } = await db.rpc(name, args);
  if (!error) return data;
  if (errors.has(error.message)) throw fail(errors.get(error.message), error.message);
  throw fail(503, 'PROVIDER_UNAVAILABLE');
}
function signedTransaction(signed, source, now, requireLive) {
  try {
    if (typeof signed !== 'string' || signed.length > 1048576) throw Error();
    const tx = TransactionBuilder.fromXDR(signed, Networks.TESTNET);
    const key = Keypair.fromPublicKey(source);
    if (!(tx instanceof Transaction) || tx.source !== source || BigInt(tx.sequence) <= 0n
      || !tx.signatures.some(signature => key.verify(tx.hash(), signature.signature()))) throw Error();
    if (!tx.timeBounds) throw Error();
    const min = BigInt(tx.timeBounds.minTime), max = BigInt(tx.timeBounds.maxTime);
    if (min < 0n || max <= min) throw Error();
    if (requireLive) {
      const current = BigInt(Math.floor(now() / 1000));
      if (min > current || max <= current || max > current + 600n) throw Error();
    }
    return tx;
  } catch {
    throw fail(409, 'INVALID_SIGNED_TRANSACTION');
  }
}
function testnetServer() {
  return new rpc.Server('https://soroban-testnet.stellar.org', { timeout: 15000 });
}

// Caller owns business authorization and signer selection. No keys or transport come from HTTP input.
export async function dispatchMoneyStep(db, input, { prepare, beforeSend, recoverPreparation = false, server, now = Date.now } = {}) {
  try { Keypair.fromPublicKey(input?.sourceAccount); } catch { throw fail(400, 'INVALID_INPUT'); }
  const claim = randomUUID();
  const identity = { p_operation: input.operationId, p_family: input.familyId, p_step_key: input.stepKey,
    p_source: input.sourceAccount, p_claim: claim };
  let state = await call(db, 'claim_money_dispatch', identity);
  if (recoverPreparation && (state.phase === 'busy' || (state.phase === 'preparing' && !state.canPrepare))
    && await call(db, 'recover_provision_preparation', { ...identity, p_claim: null })) {
    state = await call(db, 'claim_money_dispatch', identity);
  }
  if (state.canPrepare) {
    if (typeof prepare !== 'function') throw fail(400, 'INVALID_INPUT');
    let tx;
    try { tx = signedTransaction(await prepare(), input.sourceAccount, now, true); }
    catch (error) {
      if (recoverPreparation) await call(db, 'recover_provision_preparation', identity);
      if (error.code === 'INVALID_SIGNED_TRANSACTION') throw error;
      throw fail(503, 'PROVIDER_UNAVAILABLE');
    }
    state = await call(db, 'save_money_dispatch', { ...identity, p_signed: tx.toXDR(), p_hash: tx.hash().toString('hex') });
  }
  if (['busy', 'preparing', 'confirmed', 'abandoned'].includes(state.phase)) return state;
  const tx = signedTransaction(state.signedEnvelope, input.sourceAccount, now, state.phase === 'prepared');
  if (tx.hash().toString('hex') !== state.transactionHash) throw fail(409, 'DISPATCH_IDENTITY_CONFLICT');
  if (state.phase === 'prepared') {
    if (beforeSend) await beforeSend(tx);
    state = await call(db, 'claim_money_dispatch_send', identity);
    if (state.phase === 'confirmed') return state;
    if (state.canSend) {
      server ??= testnetServer();
      try {
        const receipt = await server.sendTransaction(tx);
        if (receipt.hash !== state.transactionHash) return { ...state, observation: 'mismatch' };
      } catch {
        // The send claim is already durable: never repeat or free it on a transport error.
        return { ...state, observation: 'unavailable' };
      }
    }
  }
  server ??= testnetServer();
  let observed;
  try { observed = await server.getTransaction(state.transactionHash); } catch { return { ...state, observation: 'unavailable' }; }
  if (observed.status !== 'SUCCESS') return { ...state, observation: 'unconfirmed' };
  let resultXdr;
  try {
    // SDK 16 echoes the requested txHash; independently hash the returned envelope.
    const confirmed = TransactionBuilder.fromXDR(observed.envelopeXdr, Networks.TESTNET);
    if (confirmed.hash().toString('hex') !== state.transactionHash
      || !Number.isSafeInteger(observed.ledger) || observed.ledger <= 0
      || confirmed.toXDR() !== state.signedEnvelope
      || observed.resultXdr.result().switch().name !== 'txSuccess') return { ...state, observation: 'mismatch' };
    const results = observed.resultXdr.result().results(), operations = confirmed.operations;
    if (results.length !== operations.length || !results.every((result, index) => result.switch().name === 'opInner'
      && result.tr().switch().name === operations[index].type && result.tr().value().switch().value === 0)) return { ...state, observation: 'mismatch' };
    resultXdr = observed.resultXdr.toXDR('base64');
  } catch { return { ...state, observation: 'mismatch' }; }
  return call(db, 'confirm_money_dispatch', {
    p_operation: input.operationId, p_family: input.familyId, p_step_key: input.stepKey,
    p_hash: state.transactionHash, p_ledger: String(observed.ledger), p_result_xdr: resultXdr,
  });
}
