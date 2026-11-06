import assert from 'node:assert/strict';

export const states = ['assessing', 'needs_photo', 'awaiting_parent', 'ready', 'rejected', 'expired', 'submitting', 'merchant_pending', 'failed', 'unknown', 'claimed'];
export const errors = { INVALID_INPUT: 400, UNAUTHENTICATED: 401, FORBIDDEN: 403, NOT_FOUND: 404, STALE_REVISION: 409, APPROVAL_EXPIRED: 409, IDEMPOTENCY_CONFLICT: 409, PROVIDER_UNAVAILABLE: 503 };
const uuid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const amount = value => typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value);
function keys(value, expected) {
  assert(value && typeof value === 'object' && !Array.isArray(value), 'expected object');
  assert.deepEqual(Object.keys(value).sort(), expected.split(' ').sort(), 'unexpected or missing fields');
}
export function validateFixture(f) {
  keys(f, 'mock revision name caller method path httpStatus kind body');
  assert.equal(f.mock, 'MOCK');
  assert.equal(f.revision, 's002-v1');
  assert(text(f.name));
  assert(['parent', 'student'].includes(f.caller));
  if (f.kind === 'error') {
    assert.equal(f.method, null, 'generic error method must be unspecified');
    assert.equal(f.path, null, 'generic error path must be unspecified');
    keys(f.body, 'error');
    keys(f.body.error, 'code message retryable');
    assert(Object.hasOwn(errors, f.body.error.code), 'unknown error code');
    assert.equal(f.httpStatus, errors[f.body.error.code]);
    assert(text(f.body.error.message));
    assert.equal(typeof f.body.error.retryable, 'boolean');
    return;
  }
  if (f.kind === 'identity-record') {
    keys(f.body, 'id value created_at');
    assert(uuid(f.body.id));
    assert(typeof f.body.value === 'string' && f.body.value.length >= 1 && f.body.value.length <= 120);
    assert(Number.isFinite(Date.parse(f.body.created_at)));
    assert(['GET', 'POST'].includes(f.method));
    assert.equal(f.httpStatus, f.method === 'POST' ? 201 : 200);
    assert.equal(f.path, f.method === 'POST' ? '/api/identity-records' : `/api/identity-records/${f.body.id}`);
    return;
  }
  if (f.kind === 'funding-history') {
    assert.equal(f.caller, 'parent'); assert.equal(f.path, '/api/needs-funding');
    assert.equal(f.method, 'GET'); assert.equal(f.httpStatus, 200);
    keys(f.body, 'operations confirmedNeedsStroops fundingPriceMinor fundingAmountStroops');
    assert.deepEqual(f.body.operations, []); assert.equal(f.body.confirmedNeedsStroops, '0');
    assert.equal(f.body.fundingPriceMinor, '968'); assert.equal(f.body.fundingAmountStroops, '10000000'); return;
  }
  assert.equal(f.method, 'GET');
  assert.equal(f.httpStatus, 200);
  if (f.kind === 'identity') {
    assert.equal(f.path, '/api/me');
    keys(f.body, 'userId familyId role');
    assert(uuid(f.body.userId) && uuid(f.body.familyId));
    assert.equal(f.body.role, f.caller);
  } else if (f.kind === 'purchase') {
    const p = f.body;
    keys(p, 'id revision status bucket priceMinor reason expiresAt');
    assert(uuid(p.id));
    assert.equal(f.path, `/api/purchases/${p.id}`);
    assert(Number.isSafeInteger(p.revision) && p.revision > 0);
    assert(states.includes(p.status));
    assert(['needs', 'wants', 'my_money'].includes(p.bucket));
    assert(f.caller !== 'parent' || p.bucket !== 'my_money', 'parent private purchase');
    assert(amount(p.priceMinor) && p.priceMinor !== '0', 'price must be a positive integer string');
    const reasons = {
      needs_photo: ['AI_UNCERTAIN'], awaiting_parent: ['CAP_EXCEEDED', 'CATEGORY_CONFLICT', 'RESTRICTED_ITEM'],
      rejected: ['INSUFFICIENT_FUNDS', 'PARENT_REJECTED'], expired: ['APPROVAL_EXPIRED'],
    };
    if (reasons[p.status]) assert(reasons[p.status].includes(p.reason));
    else assert.equal(p.reason, null);
    if (p.status === 'awaiting_parent') {
      assert(typeof p.expiresAt === 'string' && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(p.expiresAt));
      assert.equal(new Date(p.expiresAt).toISOString(), p.expiresAt);
    } else assert.equal(p.expiresAt, null);
    if (p.bucket === 'my_money') assert(!['needs_photo', 'awaiting_parent', 'expired'].includes(p.status));
  } else if (f.kind === 'empty-approvals') {
    assert.equal(f.path, '/api/approvals');
    assert.equal(f.caller, 'parent');
    keys(f.body, 'items');
    assert.deepEqual(f.body.items, []);
  } else assert.fail('unknown fixture kind');
}
export function validateSuite(fixtures) {
  assert(Array.isArray(fixtures) && fixtures.length > 0, 'fixtures must not be empty');
  fixtures.forEach(validateFixture);
  assert.equal(new Set(fixtures.map(f => f.name)).size, fixtures.length, 'duplicate fixture names');
  for (const role of ['parent', 'student']) assert(fixtures.some(f => f.kind === 'identity' && f.caller === role));
  for (const state of states) assert(fixtures.some(f => f.kind === 'purchase' && f.body.status === state), `missing ${state}`);
  for (const code of Object.keys(errors)) assert(fixtures.some(f => f.kind === 'error' && f.body.error.code === code), `missing ${code}`);
  assert(fixtures.some(f => f.kind === 'empty-approvals'));
  assert(fixtures.some(f => f.kind === 'purchase' && f.body.bucket === 'my_money'));
}
