// B-001 only: fixed Testnet experiment, disabled when B-005 installs real Auth.
import { timingSafeEqual } from 'node:crypto';

export const PROOF_AMOUNT = 1_000_000n; // 0.1 Testnet XLM
export const PROOF_CAP = 10_000_000n;
export const PROOF_FUNDING = 50_000_000n;
const HASH = /^[a-f0-9]{64}$/;
const ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
export const PROOF_OPERATIONS = ['registerDevice', 'registerAgent', 'fundEscrow', 'authorize', 'claim'];
export const PROOF_BODY_LIMIT = 32_768;

export class ProofError extends Error {
  constructor(code, status = 503, evidence = {}) {
    super(code);
    this.code = code;
    this.status = status;
    this.evidence = evidence;
  }
}

export function authorized(header, token) {
  if (!/^[a-f0-9]{64}$/.test(token ?? '') || typeof header !== 'string') return false;
  const expected = Buffer.from(`Bearer ${token}`);
  const supplied = Buffer.from(header);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}

export function validateAction(body, transport = 'gas') {
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ProofError('INVALID_INPUT', 400);
  const actions = ['snapshot', 'check', ...PROOF_OPERATIONS, 'status', 'transaction', 'checkout'];
  if (!actions.includes(body.action)) throw new ProofError('INVALID_INPUT', 400);
  const keys = body.action === 'status' ? ['action', 'requestId', 'transactionHash']
    : body.action === 'transaction' ? ['action', 'transactionHash']
      : transport === 'direct' && PROOF_OPERATIONS.includes(body.action) ? ['action', 'transactionXdr'] : ['action'];
  if (Object.keys(body).length !== keys.length || keys.some(key => !(key in body))) throw new ProofError('INVALID_INPUT', 400);
  if (body.action === 'status' && (typeof body.requestId !== 'string' || !ID.test(body.requestId))) throw new ProofError('INVALID_INPUT', 400);
  if (keys.includes('transactionHash') && (typeof body.transactionHash !== 'string' || !HASH.test(body.transactionHash))) throw new ProofError('INVALID_INPUT', 400);
  if (keys.includes('transactionXdr') && (typeof body.transactionXdr !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(body.transactionXdr)
    || body.transactionXdr.length > PROOF_BODY_LIMIT - 128)) throw new ProofError('INVALID_INPUT', 400);
  return body;
}

// This narrow migration is for the preserved first registration, never payments.
// Timebounds + unchanged source sequence prove nonexecution even without a
// terminal relayer reservation state. NOT_FOUND or reservation expiry alone do not.
export function validateDirectTransition(evidence, proof) {
  const history = evidence.filter(entry => entry.action === 'registerDevice');
  const last = history.at(-1)?.response;
  const prepared = history.findLastIndex(entry => entry.transactionHash === proof.transactionHash);
  const prefix = history.slice(0, prepared);
  if (evidence.some(entry => entry.command === 'transition-direct' && !entry.error) || prepared < 0
    || last?.stage !== 'submit' || last?.error?.code !== 'SUBMISSION_UNKNOWN' || !ID.test(last?.requestId ?? '')
    || last.transactionHash !== proof.transactionHash || !HASH.test(proof.transactionHash ?? '')
    || proof.ledgerStatus !== 'NOT_FOUND' || !/^[1-9][0-9]*$/.test(proof.sequence ?? '')
    || !/^[0-9]+$/.test(proof.accountSequence ?? '') || BigInt(proof.accountSequence) + 1n !== BigInt(proof.sequence)
    || !/^[1-9][0-9]*$/.test(proof.maxTime ?? '') || !Number.isFinite(Date.parse(proof.closedAt))
    || BigInt(Math.floor(Date.parse(proof.closedAt) / 1000)) <= BigInt(proof.maxTime)
    || BigInt(Math.floor(Date.now() / 1000)) <= BigInt(proof.maxTime)) throw new ProofError('TRANSITION_NOT_SAFE', 409);
  rejectedRefreshHashes(prefix, 'registerDevice');
  return { ...proof, requestId: last.requestId };
}

export function rejectedRefreshHashes(evidence, action) {
  const calls = evidence.filter(entry => entry.action === action && entry.command === 'call');
  let pending = false;
  for (const entry of calls) {
    if (entry.phase === 'dispatching') {
      if (pending) throw new ProofError('REFRESH_NOT_SAFE', 409);
      pending = true;
    } else pending = false; // Historical standalone definitive results are supported.
  }
  const rejected = outcome => outcome?.stage === 'sponsor' && !outcome?.requestId && (
    (outcome?.providerStatus === 403 && outcome?.providerCode === 'policy_disabled') ||
    (outcome?.providerStatus === 409 && outcome?.providerCode === 'idempotency_key_conflict'));
  const finished = calls.filter(entry => entry.phase !== 'dispatching');
  const hashes = [...new Set(evidence.filter(entry => entry.action === action)
    .flatMap(entry => [entry.transactionHash, entry.response?.transactionHash]).filter(value => HASH.test(value ?? '')))];
  if (!finished.some(entry => entry.response?.providerCode === 'policy_disabled') || !finished.every(entry => rejected(entry.response))
    || pending || !hashes.length) throw new ProofError('REFRESH_NOT_SAFE', 409);
  return hashes;
}

// Never copy raw SDK error messages, response bodies, headers, or signed XDR.
export function safeProviderError(error, stage, evidence = {}) {
  const safe = { stage, ...evidence };
  const allowedCodes = ['contract_not_whitelisted', 'daily_cap_exceeded', 'wallet_rate_limited',
    'reservation_expired', 'handoff_unavailable', 'submission_unknown', 'invalid_response',
    'idempotency_conflict', 'idempotency_key_conflict', 'policy_disabled', 'dependency_unavailable', 'invalid_api_key', 'unauthorized', 'timeout'];
  if (allowedCodes.includes(error?.code)) safe.providerCode = error.code;
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599) safe.providerStatus = error.status;
  return new ProofError(stage === 'submit' || stage === 'claim-submit' ? 'SUBMISSION_UNKNOWN' : 'PROVIDER_UNAVAILABLE', 503, safe);
}

export async function runProof(action, deps) {
  const { noir, gas, signers, deviceHash, asset, operationId, snapshot, envelope } = deps;
  if (action.action === 'snapshot') return snapshot();
  if (action.action === 'checkout') return { checkout: await deps.checkout() };
  if (action.action === 'check') return { check: await noir.checkPayment({ deviceHash, agent: signers.agent.publicKey, asset, amount: PROOF_AMOUNT }) };
  if (action.action === 'transaction') {
    const result = await noir.server.getTransaction(action.transactionHash);
    return { transactionHash: action.transactionHash, ledgerStatus: result.status };
  }
  if (action.action === 'status') {
    try {
      return { gas: await gas.getStatus({ requestId: action.requestId, transactionHash: action.transactionHash }) };
    } catch (error) {
      throw safeProviderError(error, 'status', { requestId: action.requestId, transactionHash: action.transactionHash });
    }
  }
  // Exact pre-signed envelope: restart/retry cannot prepare a replacement payment.
  const prepared = envelope(action.action, action.transactionXdr);
  if (deps.transport === 'direct') {
    const result = await noir.server.getTransaction(prepared.hash);
    if (result.status === 'SUCCESS' || result.status === 'FAILED') {
      return { transport: 'direct', transactionHash: prepared.hash, ledgerStatus: result.status, replayed: true };
    }
    if (result.status !== 'NOT_FOUND') throw new ProofError('SUBMISSION_UNKNOWN', 503, { transactionHash: prepared.hash });
    if (prepared.expired) throw new ProofError('ENVELOPE_EXPIRED', 409, { transactionHash: prepared.hash });
    try {
      const hash = await noir.submit(prepared.signedXdr, deps.operation(action.action).op);
      if (hash !== prepared.hash) throw new ProofError('PROVIDER_HASH_MISMATCH', 503);
      return { transport: 'direct', transactionHash: hash, ledgerStatus: 'SUCCESS', replayed: false };
    } catch (error) { throw safeProviderError(error, 'submit', { transactionHash: prepared.hash }); }
  }
  let reservation;
  try {
    reservation = await gas.sponsor(prepared.signedXdr, { idempotencyKey: `b001:${operationId}:${action.action}:${prepared.hash}`, maxRetries: 0 });
  } catch (error) { throw safeProviderError(error, 'sponsor', { transactionHash: prepared.hash }); }
  const identity = { requestId: reservation.requestId, transactionHash: reservation.transactionHash };
  if (reservation.transactionHash !== prepared.hash) throw new ProofError('PROVIDER_HASH_MISMATCH', 503);
  // Velo owns the durable reservation. A replay observes status only, even if the
  // original process died between reservation and handoff. Operator investigates.
  if (reservation.replayed) {
    try { return { replayed: true, gas: await gas.getStatus(identity) }; }
    catch (error) { throw safeProviderError(error, 'status', identity); }
  }
  try {
    const result = await gas.submit({ ...identity, transactionXdr: prepared.signedXdr }, { maxRetries: 0 });
    // A DTO describing submitted/unknown/failed is never promoted to confirmation.
    return { replayed: false, gas: result };
  } catch (error) { throw safeProviderError(error, 'submit', identity); }
}

export function createProofHandler({ env = process.env, createDependencies, execute = runProof } = {}) {
  return async function proofHandler(req, res) {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    // Deliberately before parsing, imports, signer construction, or provider calls.
    if (!authorized(req.headers.authorization, env.OPERATOR_TOKEN)) {
      return send(401, { error: { code: 'UNAUTHENTICATED', message: 'Operator authentication required', retryable: false } });
    }
    if (env.PROOF_ENABLED !== 'true') return send(404, { error: { code: 'NOT_FOUND', message: 'Proof disabled', retryable: false } });
    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return send(405, { error: { code: 'METHOD_NOT_ALLOWED', message: 'Use POST', retryable: false } });
    }
    try {
      let body = req.body;
      if (body === undefined) {
        let text = '';
        for await (const chunk of req) {
          text += chunk;
          if (Buffer.byteLength(text) > PROOF_BODY_LIMIT) throw new ProofError('INVALID_INPUT', 400);
        }
        body = text;
      }
      if (typeof body === 'string') {
        if (Buffer.byteLength(body) > PROOF_BODY_LIMIT) throw new ProofError('INVALID_INPUT', 400);
        try { body = JSON.parse(body); } catch { throw new ProofError('INVALID_INPUT', 400); }
      }
      const action = validateAction(body, env.PROOF_TRANSPORT ?? 'gas');
      const deps = await createDependencies(env);
      const result = await execute(action, deps);
      return send(200, { network: 'testnet', runtime: process.version, ...result });
    } catch (error) {
      const safe = error instanceof ProofError ? error : safeProviderError(error, 'read-or-config');
      return send(safe.status, { error: { code: safe.code, message: safe.code, retryable: false }, ...safe.evidence });
    }
  };
}
