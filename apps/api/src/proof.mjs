// B-001 only: fixed Testnet experiment, disabled when B-005 installs real Auth.
import { timingSafeEqual } from 'node:crypto';

export const PROOF_AMOUNT = 1_000_000n; // 0.1 Testnet XLM
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
  const { noir, gas, signers, deviceHash, asset, snapshot } = deps;
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
  throw new ProofError('LEGACY_WRITER_RETIRED', 410);
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
      if (PROOF_OPERATIONS.includes(action.action)) throw new ProofError('LEGACY_WRITER_RETIRED', 410);
      const deps = await createDependencies(env);
      const result = await execute(action, deps);
      return send(200, { network: 'testnet', runtime: process.version, ...result });
    } catch (error) {
      const safe = error instanceof ProofError ? error : safeProviderError(error, 'read-or-config');
      return send(safe.status, { error: { code: safe.code, message: safe.code, retryable: false }, ...safe.evidence });
    }
  };
}
