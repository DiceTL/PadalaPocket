import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Keypair } from '@stellar/stellar-sdk';
import { createDepositCreditRoute } from '../src/velo-deposit-credit-route.mjs';

// Contract checks for the T38 route. The loopback check proves the journal and
// dispatch path; these tests pin the request boundary and refusal mapping.
const source = Keypair.random();
const depositId = '11111111-1111-4111-8111-111111111111';
const familyId = '22222222-2222-4222-8222-222222222222';
const parentId = '33333333-3333-4333-8333-333333333333';

function route({ owner = { depositId, familyId, parentId }, rpcError = null, credit } = {}) {
  const calls = [];
  const database = { async rpc(name, args) { calls.push({ name, args }); return { data: owner, error: rpcError }; } };
  const credits = [];
  const handler = createDepositCreditRoute({
    database,
    sourceAccount: source.publicKey(),
    resolveDestination: async () => ({ address: Keypair.random().publicKey(), network: 'testnet', version: 1 }),
    dispatch: async () => ({ phase: 'confirmed' }),
    prepare: async () => '',
    credit: credit ?? (async (_db, input) => {
      credits.push(input);
      return { operationId: 'op-1', status: 'confirmed', confirmed: true, transactionHash: 'a'.repeat(64), confirmedLedger: '123' };
    }),
  });
  return { handler, calls, credits };
}
const request = (body, method = 'POST') => ({ method, headers: {}, body: typeof body === 'string' ? body : JSON.stringify(body) });
const response = () => {
  const res = { statusCode: 0, headers: {}, end(raw) { this.body = raw === undefined ? undefined : JSON.parse(raw); } };
  res.setHeader = (name, value) => { res.headers[name.toLowerCase()] = value; };
  return res;
};
const invoke = async (handler, body, method) => {
  const res = response();
  await handler(request(body, method), res);
  return res;
};

test('the route accepts only a deposit id and optional owner expectations', async () => {
  const { handler, calls, credits } = route();
  const res = await invoke(handler, { depositId, familyId, parentId });
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    operationId: 'op-1', status: 'confirmed', confirmed: true, transactionHash: 'a'.repeat(64), confirmedLedger: '123',
  });
  assert.deepEqual(calls, [{ name: 'resolve_velo_deposit_owner', args: { p_deposit: depositId } }]);
  assert.equal(credits.length, 1);
  assert.equal(credits[0].familyId, familyId);
  assert.equal(credits[0].parentId, parentId);
  assert.equal(credits[0].sourceAccount, source.publicKey());
});

test('amounts, destinations, signing material and unknown keys are refused before any lookup', async () => {
  const { handler, calls, credits } = route();
  for (const body of [
    {}, { depositId: 'x' }, { depositId, amountStroops: '1' },
    { depositId, destinationAccount: Keypair.random().publicKey() },
    { depositId, signedEnvelope: 'AAAA' }, { depositId, network: 'public' },
  ]) {
    const res = await invoke(handler, body);
    assert.equal(res.statusCode, 400, JSON.stringify(body));
    assert.equal(res.body.error.code, 'INVALID_INPUT');
    assert.equal(res.body.error.retryable, false);
  }
  const malformed = await invoke(handler, '{');
  assert.equal(malformed.statusCode, 400);
  for (const method of ['GET', 'PUT', 'DELETE']) {
    const res = await invoke(handler, undefined, method);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.allow, 'POST');
  }
  assert.equal(calls.length, 0);
  assert.equal(credits.length, 0);
});

test('a mismatched or unknown owner is refused without crediting', async () => {
  const { handler, credits } = route();
  for (const body of [
    { depositId, familyId: '44444444-4444-4444-8444-444444444444' },
    { depositId, parentId: '55555555-5555-4555-8555-555555555555' },
  ]) {
    const res = await invoke(handler, body);
    assert.equal(res.statusCode, 404);
    assert.equal(res.body.error.code, 'NOT_FOUND');
  }
  const missing = route({ owner: null });
  const res = await invoke(missing.handler, { depositId });
  assert.equal(res.statusCode, 404);
  assert.equal(credits.length, 0);
});

test('lookup failure and refused credits map to sanitized errors', async () => {
  const unavailable = route({ rpcError: { code: 'XX000' } });
  assert.equal((await invoke(unavailable.handler, { depositId })).statusCode, 503);

  for (const [status, code] of [[409, 'DEPOSIT_NOT_VERIFIED'], [409, 'DEPOSIT_CANCELLED'], [404, 'NOT_FOUND'], [400, 'INVALID_INPUT']]) {
    const failing = route({ credit: async () => { throw Object.assign(Error(code), { status, code }); } });
    const res = await invoke(failing.handler, { depositId });
    assert.equal(res.statusCode, status, code);
    assert.equal(res.body.error.code, code);
  }
  const unknown = route({ credit: async () => { throw Object.assign(Error('boom'), { status: 500 }); } });
  const res = await invoke(unknown.handler, { depositId });
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.error.retryable, true);
});
