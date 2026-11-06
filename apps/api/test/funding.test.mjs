import { test } from 'node:test';
import assert from 'node:assert/strict';
import { funding } from '../src/funding.mjs';
const res = () => ({ setHeader() {}, end(raw) { this.body = JSON.parse(raw); } });
const key = '8de9b1e9-bb2b-4f7d-886e-86f588b769f6';
function fixture({ ledgerStatus = 'NOT_FOUND', balance = 10000000n, steps = { fund: { hash: 'exact-stored-hash' } } } = {}) {
  const row = { id: 'op', status: 'unknown', steps, amount_stroops: '10000000', device_hash: 'device' };
  const hashes = [];
  let inserts = 0;
  const query = {
    select() { return this; },
    eq() { return this; },
    order: async () => ({ data: [row] }),
    maybeSingle: async () => ({ data: row }),
    insert() { inserts++; throw Error('Unexpected insert'); },
    update(patch) { return { eq: async () => { Object.assign(row, patch); return {}; } }; },
  };
  const deps = {
    authenticate: async () => ({ member: { role: 'parent', family_id: 'family', user_id: 'parent' } }),
    database: () => ({ from: () => query }),
    ledger: () => ({ server: { httpClient: { defaults: {} }, getTransaction: async hash => { hashes.push(hash); return { status: ledgerStatus }; } }, getEscrowBalance: async () => balance,
      prepare() { throw Error('Unexpected prepare'); }, submit() { throw Error('Unexpected submit'); } }),
  };
  return { row, hashes, deps, inserts: () => inserts, setStatus: value => { ledgerStatus = value; } };
}
for (const method of ['GET', 'POST']) test(`unauthenticated ${method} is denied before database or ledger access`, async () => {
  const response = res();
  await funding({ method, headers: {} }, response, { database() { assert.fail('database accessed'); }, ledger() { assert.fail('ledger accessed'); } });
  assert.equal(response.statusCode, 401);
});
test('student funding is refused before privileged database access', async () => {
  const response = res();
  await funding({ method: 'POST' }, response, { authenticate: async () => ({ member: { role: 'student' } }), database() { assert.fail('database accessed'); } });
  assert.equal(response.statusCode, 403);
});
for (const status of ['NOT_FOUND', 'FAILED', 'SUCCESS']) test(`saved funding hash reconciles ${status} without dispatch`, async () => {
  const f = fixture({ ledgerStatus: status }); const response = res();
  await funding({ method: 'GET' }, response, f.deps);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(f.hashes, ['exact-stored-hash']);
  assert.equal(f.row.status, { NOT_FOUND: 'unknown', FAILED: 'failed', SUCCESS: 'confirmed' }[status]);
  assert.equal(response.body.confirmedNeedsStroops, status === 'SUCCESS' ? '10000000' : '0');
  if (status === 'SUCCESS') assert.equal(f.row.escrow_stroops, '10000000');
});
test('ledger SUCCESS with insufficient escrow never confirms or credits', async () => {
  const f = fixture({ ledgerStatus: 'SUCCESS', balance: 9999999n }); const response = res();
  await funding({ method: 'GET' }, response, f.deps);
  assert.equal(response.statusCode, 503); assert.equal(f.row.status, 'unknown');
  assert.equal(response.body.confirmedNeedsStroops, undefined); assert.equal(f.row.escrow_stroops, undefined);
});
test('concurrent same-key replays return one durable operation without inserting or sending', async () => {
  const f = fixture({ ledgerStatus: 'SUCCESS' });
  const responses = await Promise.all([1, 2].map(async () => { const response = res();
    await funding({ method: 'POST', headers: { 'idempotency-key': key }, body: { priceMinor: '968' } }, response, f.deps); return response;
  }));
  assert.equal(f.inserts(), 0);
  for (const response of responses) { assert.equal(response.statusCode, 200); assert.equal(response.body.id, 'op'); assert.equal(response.body.transactionHash, 'exact-stored-hash'); }
});
test('interrupted registration replay stays blocked and never prepares a funding transaction', async () => {
  const f = fixture({ steps: { device: { hash: 'registration-hash', signed: 'stored-envelope' } } }); const response = res();
  await funding({ method: 'POST', headers: { 'idempotency-key': key }, body: { priceMinor: '968' } }, response, f.deps);
  assert.equal(response.statusCode, 200); assert.equal(response.body.status, 'unknown'); assert.equal(f.inserts(), 0);
});

test('fresh request recovers a previously unknown hash only after SUCCESS and backing read', async () => {
  const f = fixture(); const first = res();
  await funding({ method: 'GET' }, first, f.deps);
  assert.equal(first.body.confirmedNeedsStroops, '0');
  f.setStatus('SUCCESS'); const second = res();
  await funding({ method: 'GET' }, second, f.deps);
  assert.equal(second.body.operations[0].status, 'confirmed');
  assert.equal(second.body.confirmedNeedsStroops, '10000000');
  assert.deepEqual(f.hashes, ['exact-stored-hash', 'exact-stored-hash']);
});
