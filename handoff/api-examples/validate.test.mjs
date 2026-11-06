import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateFixture, validateSuite } from './validate.mjs';
const fixtures = JSON.parse(readFileSync(new URL('./cases.json', import.meta.url)));
test('complete fixture suite validates', () => validateSuite(fixtures));
const purchase = fixtures.find(f => f.kind === 'purchase');
for (const [name, mutate] of [
  ['numeric money', f => { f.body.priceMinor = 7500; }],
  ['negative money', f => { f.body.priceMinor = '-1'; }],
  ['fractional money', f => { f.body.priceMinor = '1.5'; }],
  ['unknown state', f => { f.body.status = 'paid'; }],
  ['fake proof', f => { f.body.transactionHash = 'fake'; }],
  ['private parent purchase', f => { f.caller = 'parent'; f.body.bucket = 'my_money'; }],
  ['unknown fields', f => { f.body.walletAddress = 'invented'; }],
  ['missing marker', f => { delete f.mock; }],
  ['missing fields', f => { delete f.body.id; }],
  ['invalid reason', f => { f.body.reason = 'APPROVED'; }],
]) test(`rejects ${name}`, () => {
  const f = structuredClone(purchase); mutate(f); assert.throws(() => validateFixture(f));
});
test('parent identity cannot contain private balances, including nested additions', () => {
  const f = structuredClone(fixtures[0]); f.body.balances = { myMoney: '100' };
  assert.throws(() => validateFixture(f));
});
test('parent empty list cannot smuggle purchases', () => {
  const f = structuredClone(fixtures.find(f => f.kind === 'empty-approvals'));
  f.body.items.push({ bucket: 'my_money' }); assert.throws(() => validateFixture(f));
});
test('invalid expiry and error code/type/status fail', () => {
  for (const mutate of [f => { f.body.expiresAt = 'tomorrow'; }, f => { f.body.expiresAt = null; }]) {
    const f = structuredClone(fixtures.find(f => f.body.status === 'awaiting_parent'));
    mutate(f); assert.throws(() => validateFixture(f));
  }
  for (const mutate of [f => { f.body.error.code = 'BOGUS'; }, f => { f.body.error.retryable = 'yes'; }, f => { f.httpStatus = 200; }]) {
    const f = structuredClone(fixtures.find(f => f.kind === 'error')); mutate(f); assert.throws(() => validateFixture(f));
  }
});
test('missing coverage, empty suite and duplicate names fail', () => {
  assert.throws(() => validateSuite([]));
  assert.throws(() => validateSuite(fixtures.filter(f => f.body.status !== 'unknown')));
  assert.throws(() => validateSuite([...fixtures, fixtures[0]]));
});

test('generic errors cannot claim endpoint mappings; successful reads retain theirs', () => {
  const error = fixtures.find(f => f.kind === 'error');
  for (const mutate of [f => { f.method = 'GET'; }, f => { f.path = '/api/me'; }]) {
    const f = structuredClone(error); mutate(f); assert.throws(() => validateFixture(f));
  }
  for (const kind of ['identity', 'purchase', 'empty-approvals']) {
    for (const field of ['method', 'path']) {
      const f = structuredClone(fixtures.find(f => f.kind === kind));
      f[field] = null; assert.throws(() => validateFixture(f));
    }
  }
});
