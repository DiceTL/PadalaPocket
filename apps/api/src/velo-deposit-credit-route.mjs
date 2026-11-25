import { Keypair } from '@stellar/stellar-sdk';
import { creditVeloDeposit } from './velo-deposit-credit.mjs';

// T38: the operator-side caller for the T15 credit. Only the isolated
// coordinator mounts this route; the internal token is checked before it runs.
// The body may name a deposit and optional owner expectations, never signing
// material, an amount or a destination.
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const fields = new Set(['depositId', 'familyId', 'parentId']);
const messages = new Map([
  ['INVALID_INPUT', [400, 'Invalid deposit credit request.']],
  ['FORBIDDEN', [403, 'Forbidden.']],
  ['NOT_FOUND', [404, 'Deposit not found.']],
  ['DEPOSIT_NOT_VERIFIED', [409, 'Deposit is not verified.']],
  ['DEPOSIT_CANCELLED', [409, 'Deposit is cancelled or fenced.']],
  ['INVALID_DESTINATION', [409, 'Trusted destination is invalid.']],
  ['TRANSFER_IDENTITY_MISMATCH', [409, 'Trusted destination is invalid.']],
  ['DEPOSIT_CREDIT_CONFLICT', [409, 'Deposit credit conflicted.']],
  ['TRANSFER_MISMATCH', [409, 'Deposit credit conflicted.']],
  ['SIGNING_IDENTITY_MISMATCH', [409, 'Deposit credit conflicted.']],
]);

const invalid = () => Object.assign(Error('INVALID_INPUT'), { status: 400, code: 'INVALID_INPUT' });

function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  for (const [name, value] of Object.entries(headers)) res.setHeader(name, value);
  res.end(JSON.stringify(body));
}
function failure(res, code) {
  const [status, message] = messages.get(code) ?? [503, 'Deposit credit unavailable.'];
  send(res, status, { error: { code: status === 503 ? 'PROVIDER_UNAVAILABLE' : code, message, retryable: status === 503 } });
}

async function readBody(req, limit) {
  if (req.body !== undefined) {
    const text = typeof req.body === 'string' ? req.body
      : Buffer.isBuffer(req.body) ? req.body.toString('utf8') : null;
    if (text === null || Buffer.byteLength(text) > limit) throw invalid();
    try { return JSON.parse(text); } catch { throw invalid(); }
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > limit) throw invalid();
    chunks.push(Buffer.from(chunk));
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw invalid(); }
}

export function createDepositCreditRoute({
  database, credit = creditVeloDeposit, sourceAccount, resolveDestination, dispatch, prepare, bodyLimit = 4096,
}) {
  if (!database || typeof database.rpc !== 'function' || !sourceAccount) throw Error('COORDINATOR_NOT_CONFIGURED');
  try { Keypair.fromPublicKey(sourceAccount); } catch { throw Error('COORDINATOR_NOT_CONFIGURED'); }
  if (typeof credit !== 'function' || typeof resolveDestination !== 'function'
    || typeof dispatch !== 'function' || typeof prepare !== 'function') throw Error('COORDINATOR_NOT_CONFIGURED');

  return async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method !== 'POST') return send(res, 405, { error: { code: 'INVALID_INPUT', message: 'Use POST.', retryable: false } }, { Allow: 'POST' });
    let body;
    try { body = await readBody(req, bodyLimit); } catch { return failure(res, 'INVALID_INPUT'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)
      || Object.keys(body).some(key => !fields.has(key))
      || !uuid.test(body.depositId ?? '')
      || (body.familyId !== undefined && !uuid.test(body.familyId))
      || (body.parentId !== undefined && !uuid.test(body.parentId))) return failure(res, 'INVALID_INPUT');

    // The deposit determines the family; caller values are expectations only.
    let owner;
    try {
      const { data, error } = await database.rpc('resolve_velo_deposit_owner', { p_deposit: body.depositId });
      if (error) return failure(res, 'PROVIDER_UNAVAILABLE');
      owner = data;
    } catch { return failure(res, 'PROVIDER_UNAVAILABLE'); }
    if (!owner || !uuid.test(owner.familyId ?? '') || !uuid.test(owner.parentId ?? '')) return failure(res, 'NOT_FOUND');
    if ((body.familyId !== undefined && body.familyId !== owner.familyId)
      || (body.parentId !== undefined && body.parentId !== owner.parentId)) return failure(res, 'NOT_FOUND');

    try {
      const result = await credit(database, {
        depositId: body.depositId, familyId: owner.familyId, parentId: owner.parentId,
        sourceAccount, resolveDestination, dispatch, prepare,
      });
      return send(res, 200, {
        operationId: result.operationId, status: result.status, confirmed: result.confirmed,
        transactionHash: result.transactionHash, confirmedLedger: result.confirmedLedger,
      });
    } catch (error) {
      if (error.status === 400 || error.status === 403 || error.status === 404 || error.status === 409) {
        return failure(res, error.code ?? 'INVALID_INPUT');
      }
      return failure(res, 'PROVIDER_UNAVAILABLE');
    }
  };
}
