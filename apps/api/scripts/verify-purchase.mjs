// Read/replay an EXISTING purchase only. Never creates a new request key.
import { createClient } from '@supabase/supabase-js';
import { NoirAgentClient } from '@noirx402/agent-sdk';
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
const base = process.env.R001_BASE_URL, id = process.env.R002_PURCHASE_ID;
if (!base?.startsWith('https://') || !/^[0-9a-f-]{36}$/i.test(id ?? '')) throw Error('Provide deployment origin and EXISTING purchase UUID.');
const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const before = await db.from('needs_purchases').select('*').eq('id', id).single(); assert.equal(before.error, null);
const row = before.data; assert.equal(row.status, 'claimed');
const { accounts } = JSON.parse(await readFile('.env.r001-accounts.json', 'utf8'));
let studentToken; const authClients = [];
for (const account of accounts) {
  const auth = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  authClients.push(auth);
  const { data, error } = await auth.auth.signInWithPassword({ email: account.email, password: account.password }); assert.equal(error, null);
  const authorization = `Bearer ${data.session.access_token}`;
  if (account.role === 'student') studentToken = authorization;
  const photo = await fetch(`${base}/api/purchases/${id}/photo`, { headers: { authorization } }); assert.equal(photo.status, 200);
  if (account.role === 'parent') assert.equal((await fetch(base + '/api/purchases', { method: 'POST', headers: { authorization } })).status, 403);
}
assert.equal((await fetch(`${base}/api/purchases/${id}/photo`)).status, 401);
const headers = { authorization: studentToken, 'Content-Type': 'application/json', 'Idempotency-Key': row.request_key };
const payload = { sellerId: row.seller_id, priceMinor: row.price_minor, mime: row.photo_mime, photoBase64: row.photo_base64 };
const replay = await Promise.all([1,2].map(async () => { const r = await fetch(base + '/api/purchases', { method: 'POST', headers, body: JSON.stringify(payload) }); assert.equal(r.status, 200); return r.json(); }));
for (const result of replay) { assert.equal(result.id, id); assert.equal(result.status, 'claimed'); assert.equal(result.transactions.claim.hash, row.steps.claim.hash); }
assert.equal((await fetch(base + '/api/purchases', { method: 'POST', headers, body: JSON.stringify({ ...payload, priceMinor: (BigInt(row.price_minor) + 1n).toString() }) })).status, 409);
const after = await db.from('needs_purchases').select('steps,ai_usage,status').eq('id', id).single(); assert.equal(after.error, null);
assert.deepEqual(after.data.steps, row.steps); assert.deepEqual(after.data.ai_usage, row.ai_usage);
const noir = new NoirAgentClient({ network: 'testnet' }); noir.server.httpClient.defaults.timeout = 15000;
const statuses = {};
for (const stage of ['policy','authorize','claim']) { const result = await noir.server.getTransaction(row.steps[stage].hash); assert.equal(result.status, 'SUCCESS'); statuses[stage] = { hash: row.steps[stage].hash, status: result.status }; }
assert.equal(await noir.getPendingBalance(row.evidence.merchant), 0n);
const device = createHash('sha256').update('PadalaPocket Needs ' + row.family_id).digest('hex');
const escrowStroops = (await noir.getEscrowBalance(device)).toString();
for (const client of authClients) await client.auth.signOut({ scope: 'local' });
await new Promise(resolve => process.stdout.write(JSON.stringify({ result: 'pass', escrowStroops, purchaseId: id, statuses, concurrentReplayPreservesEnvelopesAndAiUsage: true, privatePhotoAccess: 'student/linked-parent allowed; anonymous denied', changedPayloadDenied: true }) + '\n', resolve));
// All checks and temporary-session sign-outs have completed. Close SDK idle handles.
process.exit(0);
