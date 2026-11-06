// Explicit live R-001 gate check; no payment/provider proof calls.
import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
const base = process.env.R001_BASE_URL;
if (!base?.startsWith('https://')) throw new Error('Set R001_BASE_URL to the deployed HTTPS origin.');
const state = JSON.parse(await readFile('.env.r001-accounts.json', 'utf8'));
const client = () => createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const sessions = [];
for (const account of state.accounts) {
  const auth = client();
  const { data, error } = await auth.auth.signInWithPassword({ email: account.email, password: account.password });
  assert.equal(error, null);
  const token = data.session.access_token;
  const request = async (path, options = {}) => {
    const response = await fetch(`${base}${path}`, { ...options, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers } });
    return { status: response.status, body: await response.json() };
  };
  const me = await request('/api/me');
  assert.equal(me.status, 200); assert.equal(me.body.role, account.role); assert.equal(me.body.userId, account.id);
  assert.deepEqual(Object.keys(me.body).sort(), ['familyId', 'role', 'userId']);
  sessions.push({ account, auth, request });
  console.log(JSON.stringify({ check: 'deployed-signin-me', role: account.role, result: 'pass' }));
}
assert.equal((await fetch(`${base}/api/me`)).status, 401);
assert.equal((await fetch(`${base}/api/operator/proof`)).status, 404);
for (const session of sessions) {
  const key = randomUUID();
  const options = { method: 'POST', headers: { 'Idempotency-Key': key }, body: JSON.stringify({ value: 'R-001 synthetic persistence check' }) };
  const results = await Promise.all([session.request('/api/identity-records', options), session.request('/api/identity-records', options)]);
  assert.deepEqual(results.map(r => r.status).sort(), [200, 201]);
  const id = results[0].body.id;
  assert.equal(results[1].body.id, id);
  const fresh = client();
  const { data, error } = await fresh.auth.signInWithPassword({ email: session.account.email, password: session.account.password });
  assert.equal(error, null);
  const read = await fetch(`${base}/api/identity-records/${id}`, { headers: { Authorization: `Bearer ${data.session.access_token}` } });
  assert.equal(read.status, 200); assert.equal((await read.json()).value, 'R-001 synthetic persistence check');
  const other = sessions.find(s => s !== session);
  assert.equal((await other.request(`/api/identity-records/${id}`)).status, 404);
  const directRead = await other.auth.from('identity_records').select('id').eq('id', id);
  assert.equal(directRead.error, null); assert.deepEqual(directRead.data, []);
  const spoof = await session.auth.from('identity_records').insert({ user_id: other.account.id, request_key: randomUUID(), value: 'denied' });
  assert.ok(spoof.error);
  const roleChange = await session.auth.from('family_members').update({ role: 'student' }).eq('user_id', session.account.id);
  assert.ok(roleChange.error);
  const conflict = await session.request('/api/identity-records', { ...options, body: JSON.stringify({ value: 'changed' }) });
  assert.equal(conflict.status, 409);
  console.log(JSON.stringify({ check: 'fresh-session-read-ownership-rls-idempotency', role: session.account.role, recordId: id, result: 'pass' }));
  await fresh.auth.signOut({ scope: 'local' });
}
for (const session of sessions) await session.auth.auth.signOut({ scope: 'local' });
console.log('PASS: deployed R-001 HTTP/Auth/database gate (browser checks separate).');
