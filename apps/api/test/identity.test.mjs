import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createIdentityHandler } from '../src/identity.mjs';

const userId = '00000000-0000-4000-8000-000000000001';
async function call({ url = '/api/me', method = 'GET', token = 'test', body, key, role = 'parent', authError, memberError, record } = {}) {
  const filters = [];
  let table;
  const query = {
    select() { return this; },
    eq(k, v) { filters.push([k, v]); return this; },
    maybeSingle: async () => table === 'family_members'
      ? { data: role ? { user_id: userId, family_id: 'family', role } : null, error: memberError }
      : { data: record },
  };
  let created = false;
  const handler = createIdentityHandler({ env: { SUPABASE_URL: 'https://example.test', SUPABASE_PUBLISHABLE_KEY: 'public' }, clientFactory: () => {
    created = true;
    return { auth: { getUser: async () => ({ data: { user: { id: userId, user_metadata: { role: 'operator' } } }, error: authError }) }, from: (name) => { table = name; return query; } };
  } });
  const res = { headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(raw) { this.body = JSON.parse(raw); } };
  await handler({ url, method, body, headers: { authorization: token ? `Bearer ${token}` : undefined, 'idempotency-key': key } }, res);
  return { ...res, filters, created };
}
test('identity requires bearer auth before touching the provider', async () => {
  const r = await call({ token: null });
  assert.equal(r.statusCode, 401); assert.equal(r.created, false);
});
test('role comes from trusted membership, never editable user metadata', async () => {
  for (const role of ['parent', 'student']) {
    const r = await call({ role }); assert.equal(r.statusCode, 200); assert.equal(r.body.role, role);
    assert.deepEqual(r.filters, [['user_id', userId]]);
  }
  assert.equal((await call({ role: null })).statusCode, 403);
  assert.equal((await call({ authError: { status: 401 } })).statusCode, 401);
  assert.equal((await call({ memberError: {} })).statusCode, 503);
});
test('owned record lookup restricts both id and authenticated owner', async () => {
  const id = '00000000-0000-4000-8000-000000000002';
  const r = await call({ url: `/api/identity-records/${id}` });
  assert.equal(r.statusCode, 404); assert.deepEqual(r.filters.slice(-2), [['id', id], ['user_id', userId]]);
});
test('writes reject caller supplied ownership and missing request keys', async () => {
  assert.equal((await call({ url: '/api/identity-records', method: 'POST', body: { value: 'synthetic' } })).statusCode, 400);
  assert.equal((await call({ url: '/api/identity-records', method: 'POST', key: userId, body: { value: 'synthetic', user_id: 'other' } })).statusCode, 400);
});


test('trailing slash and extra path segments are rejected before provider access', async () => {
  for (const url of ['/api/identity-records/', '/api/identity-records//', '/api/identity-records/id/extra']) {
    const result = await call({ url, method: 'POST', body: { value: 'synthetic' }, key: userId });
    assert.equal(result.statusCode, 404);
    assert.equal(result.created, false);
  }
});
