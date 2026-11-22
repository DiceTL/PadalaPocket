import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { test } from 'node:test';
import { Keypair } from '@stellar/stellar-sdk';
import handler from '../api/index.js';
import { proxyFinancial } from '../src/money-proxy.mjs';

// Exercise the real function entry point without live provider calls or persisted keys.
test('Vercel entry rejects callers and keeps financial routes closed until authority is verified', async t => {
  const keys = ['OWNER', 'AGENT', 'MERCHANT', 'STUDENT'].map(role => [role, Keypair.random()]);
  const sources = keys.map(([, key]) => key.publicKey());
  const guard = Keypair.random();
  const token = randomBytes(32).toString('hex');
  const env = {
    ...Object.fromEntries(keys.map(([role, key]) => [`${role}_SECRET`, key.secret()])),
    MONEY_COORDINATOR_GUARD_SECRET: guard.secret(), MONEY_COORDINATOR_ACCESS_TOKEN: token,
    MONEY_COORDINATOR_DATABASE_TOKEN: `test.${Buffer.from(JSON.stringify({ role: 'money_coordinator' })).toString('base64url')}.test`,
    MONEY_COORDINATOR_ACTIVATED_AT: '2020-01-01T00:00:00Z', SUPABASE_PUBLISHABLE_KEY: 'test',
    SUPABASE_URL: 'https://coordinator-db.example.test',
  };
  for (const [name, value] of Object.entries(env)) {
    const prior = process.env[name];
    t.after(() => { if (prior === undefined) delete process.env[name]; else process.env[name] = prior; });
    process.env[name] = value;
  }
  const httpFetch = globalThis.fetch;
  let authorityReady = false, databaseReady = false, accountReads = 0, databaseReads = 0;
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin === 'https://horizon-testnet.stellar.org') {
      accountReads++;
      const source = url.pathname.slice('/accounts/'.length);
      assert.ok(sources.includes(source));
      return Response.json({ account_id: source, thresholds: { low_threshold: 2, med_threshold: 2, high_threshold: 2 },
        signers: (authorityReady ? [source, guard.publicKey()] : [source]).map(key => ({ key, weight: 1, type: 'ed25519_public_key' })) });
    }
    if (url.origin === env.SUPABASE_URL && url.pathname === '/rest/v1/rpc/read_money_cutover_access') {
      databaseReads++;
      return Response.json({ role: databaseReady ? 'money_coordinator' : 'service_role', readsSigned: true });
    }
    assert.fail('Unexpected provider request');
  });
  const server = createServer(handler);
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const get = (path, authorized = true) => httpFetch(origin + path, {
    headers: authorized ? { 'x-money-coordinator-token': token } : {},
  });
  assert.equal((await get('/internal/authority', false)).status, 403);
  assert.equal((await get('/api/purchases', false)).status, 403);
  assert.equal((await get('/api/me')).status, 404);
  assert.equal(accountReads, 0); assert.equal(databaseReads, 0);
  const unavailable = await get('/api/purchases');
  assert.deepEqual(await unavailable.json(), { error: { code: 'PROVIDER_UNAVAILABLE', message: 'Financial service unavailable.', retryable: false } });
  assert.equal(unavailable.status, 503); assert.equal(unavailable.headers.get('cache-control'), 'no-store');
  assert.equal(accountReads, 4);
  authorityReady = true;
  assert.equal((await get('/api/purchases')).status, 503);
  assert.equal(databaseReads, 1);
  for (const [path, code, retryable] of [
    ['/api/allowance-funding', 'PROVIDER_UNAVAILABLE', true],
    ['/api/demo/advance', 'WEEKLY_UNAVAILABLE', false],
  ]) {
    const response = await get(path);
    assert.equal(response.status, 503);
    const { error } = await response.json();
    assert.equal(error.code, code);
    assert.equal(error.retryable, retryable);
  }
  databaseReady = true;
  assert.equal((await get('/api/purchases')).status, 401); // A valid internal token is not a user session.
  const ready = await get('/internal/authority');
  assert.equal(ready.status, 200);
  assert.deepEqual(await ready.json(), { network: 'testnet', boundary: 't08', databaseRole: 'money_coordinator',
    activatedAt: env.MONEY_COORDINATOR_ACTIVATED_AT, guardAccount: guard.publicKey(), sources });
  authorityReady = false;
  assert.equal((await get('/internal/authority')).status, 503); // Readiness rechecks the ledger on warm invocations.
});

const proxyEnv = {
  SUPABASE_URL: 'https://auth.example.test', SUPABASE_PUBLISHABLE_KEY: 'test',
  MONEY_COORDINATOR_URL: 'https://coordinator.example.test', MONEY_COORDINATOR_ACCESS_TOKEN: 'a'.repeat(64),
};
const proxyRequest = (path, method = 'GET') => ({ url: path, method, headers: { authorization: 'Bearer test' } });
const proxyResponse = () => ({ headers: new Headers(), setHeader(name, value) { this.headers.set(name, value); }, end(bytes) { this.bytes = bytes; } });
const parent = { user_id: 'parent', family_id: 'family', role: 'parent', wallet_ready: true };

test('public proxy normalizes platform failures but preserves application errors and photos', async t => {
  let upstream;
  t.mock.method(globalThis, 'fetch', async input => {
    const url = new URL(input);
    if (url.origin === proxyEnv.SUPABASE_URL) {
      if (url.pathname === '/auth/v1/user') return Response.json({ id: 'parent' });
      if (url.pathname === '/rest/v1/family_members') return Response.json(parent);
    }
    assert.equal(url.origin, proxyEnv.MONEY_COORDINATOR_URL);
    return upstream;
  });
  for (const platformError of [
    new Response('<html>Gateway timeout</html>', { status: 504, headers: { 'content-type': 'text/html' } }),
    Response.json({ code: 'FUNCTION_INVOCATION_TIMEOUT' }, { status: 504 }),
  ]) {
    upstream = platformError;
    const response = proxyResponse();
    await proxyFinancial(proxyRequest('/api/weekly'), response, { env: proxyEnv });
    assert.equal(response.statusCode, 503);
    assert.equal(response.headers.get('content-type'), 'application/json');
    assert.deepEqual(JSON.parse(response.bytes), { error: {
      code: 'WEEKLY_UNAVAILABLE', message: 'Weekly service unavailable.', retryable: false,
    } });
  }
  const applicationError = { error: { code: 'FORBIDDEN', message: 'Forbidden.', retryable: false } };
  upstream = Response.json(applicationError, { status: 403 });
  const denied = proxyResponse();
  await proxyFinancial(proxyRequest('/api/purchases'), denied, { env: proxyEnv });
  assert.equal(denied.statusCode, 403);
  assert.deepEqual(JSON.parse(denied.bytes), applicationError);

  upstream = new Response(new Uint8Array([0, 128, 255]), { headers: { 'content-type': 'image/png' } });
  const photo = proxyResponse();
  await proxyFinancial(proxyRequest('/api/purchases/id/photo'), photo, { env: proxyEnv });
  assert.equal(photo.statusCode, 200);
  assert.equal(photo.headers.get('content-type'), 'image/png');
  assert.deepEqual(photo.bytes, Buffer.from([0, 128, 255]));
});

test('public deadline expires during Auth, before a financial request can be forwarded', async t => {
  const controller = new AbortController();
  t.mock.method(AbortSignal, 'timeout', () => controller.signal);
  const auth = Promise.withResolvers(), started = Promise.withResolvers();
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (input, init) => {
    const url = new URL(input);
    requests.push(url.pathname);
    if (url.pathname === '/auth/v1/user') {
      started.resolve(init?.signal);
      return auth.promise;
    }
    return Response.json(parent);
  });
  const response = proxyResponse();
  const invocation = proxyFinancial(proxyRequest('/api/allowance-funding'), response, { env: proxyEnv });
  const authSignal = await started.promise;
  controller.abort();
  await invocation;
  assert.equal(authSignal.aborted, true);
  assert.equal(response.statusCode, 503);
  assert.equal(JSON.parse(response.bytes).error.retryable, true);
  auth.resolve(Response.json({ id: 'parent' }));
  await new Promise(resolve => setImmediate(resolve));
  assert.ok(!requests.includes('/api/allowance-funding'));
});
