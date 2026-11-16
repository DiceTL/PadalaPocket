import { test, mock, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createApiClient, ApiError } from '../../web/src/client/api.js';
import { handler as router } from '../src/router.mjs';
import { createIdentityHandler } from '../src/identity.mjs';
import { accounts } from '../src/accounts.mjs';
import { family, DEFAULT_SETTINGS, purchaseRulesFromSettings } from '../src/family.mjs';
import { funding } from '../src/funding.mjs';
import { purchases } from '../src/purchases.mjs';
import { approvalBinding } from '../src/purchase-approval.mjs';
import { weekly } from '../src/weekly.mjs';
import { veloTopups } from '../src/velo-topups.mjs';

// These checks exercise the unchanged browser client against real handlers with
// isolated database/provider results. They establish no hosted or ledger acceptance.
beforeEach(() => mock.method(globalThis, 'fetch', () => { throw Error('Live network forbidden in contract baseline'); }));
afterEach(() => mock.restoreAll());
const id = '11111111-1111-4111-8111-111111111111';
const stamp = '2026-11-07T00:00:00Z';
const member = { user_id: 'student', family_id: 'family', role: 'student' };
const rules = { revision: 1, settings: structuredClone(DEFAULT_SETTINGS), updatedAt: stamp };
const policy = purchaseRulesFromSettings(rules);
const digest = value => createHash('sha256').update(value).digest('hex');
const payload = { bucket: 'needs', sellerId: 'demo-seller', priceMinor: '242', mime: 'image/png', photoBase64: Buffer.from('synthetic photo').toString('base64') };
const purchase = {
  id, family_id: 'family', student_id: 'student', request_key: id, bucket: 'needs',
  seller_id: 'demo-seller', price_minor: '242', amount_stroops: '2500000',
  status: 'claimed', reason: null, reserved: true, rules: policy, created_at: stamp,
  ai: { productName: 'Notebook', category: 'school_supplies', uncertain: false, prohibited: false },
  photo_mime: payload.mime, photo_base64: payload.photoBase64,
  photo_hash: digest(Buffer.from(payload.photoBase64, 'base64')),
  fingerprint: digest(JSON.stringify(['demo-seller', '242', payload.mime, digest(Buffer.from(payload.photoBase64, 'base64'))])),
  steps: { claim: { hash: 'claim-hash' } }, evidence: { claimLedgerStatus: 'SUCCESS' },
};
const expectedPurchase = {
  id, bucket: 'needs', requestKey: id, status: 'claimed', reason: null, sellerId: 'demo-seller',
  priceMinor: '242', amountStroops: '2500000', rules: policy, ai: purchase.ai, createdAt: stamp,
  approvalBinding: null, approvalDeadline: null, parentDecision: null,
  executionStarted: false, completedStages: 0, transactions: { claim: { hash: 'claim-hash' } }, evidence: purchase.evidence,
};

// Ordered results keep the contract tests independent of a second database implementation.
function database(results, rpc = async () => ({ data: null })) {
  const remaining = [...results];
  return {
    rpc,
    from(table) {
      assert.ok(remaining.length, `Unexpected database access: ${table}`);
      const [expectedTable, data] = remaining.shift();
      assert.equal(table, expectedTable);
      const result = () => Promise.resolve({ data: structuredClone(data) });
      const query = { then: (resolve, reject) => result().then(resolve, reject) };
      for (const method of ['select', 'eq', 'order', 'limit', 'upsert', 'update']) query[method] = () => query;
      query.single = query.maybeSingle = result;
      return query;
    },
    finished() { assert.equal(remaining.length, 0, 'Expected database reads were skipped'); },
  };
}

async function exchange({ invoke, path, method = 'GET', body, key, handler, deps = {}, status = 200, anonymous = false, signal }) {
  const api = createApiClient({ mode: 'live', getAccessToken: async () => anonymous ? null : 'synthetic-session', fetchImpl: async (url, options) => {
    assert.equal(url, path);
    assert.equal(options.method ?? 'GET', method);
    assert.deepEqual(options.body === undefined ? undefined : JSON.parse(options.body), body);
    assert.equal(options.headers['Idempotency-Key'], key);
    if (!anonymous) assert.equal(options.headers.Authorization, 'Bearer synthetic-session');
    if (body !== undefined) assert.equal(options.headers['Content-Type'], 'application/json');
    if (signal) assert.equal(options.signal, signal);
    const headers = {};
    let raw;
    const response = { setHeader(name, value) { headers[name.toLowerCase()] = value; }, end(value) { raw = value; } };
    await handler({ url, method: options.method ?? 'GET', body: options.body, headers: Object.fromEntries(Object.entries(options.headers).map(([name, value]) => [name.toLowerCase(), value])) }, response, deps);
    assert.equal(response.statusCode, status);
    assert.equal(headers['cache-control'], 'no-store');
    return new Response(raw, { status: response.statusCode, headers });
  } });
  return invoke(api);
}
const dependencies = (db, role = 'parent') => ({ database: () => db, authenticate: async () => ({ member: { ...member, role } }) });

test('identity uses the direct body and preserves optional wallet readiness', async () => {
  for (const role of ['parent', 'student']) {
    const db = database([['family_members', { ...member, role, wallet_ready: false }]]);
    db.auth = { getUser: async () => ({ data: { user: { id: member.user_id } } }) };
    const handler = createIdentityHandler({ env: { SUPABASE_URL: 'https://example.test', SUPABASE_PUBLISHABLE_KEY: 'synthetic-public' }, clientFactory: () => db });
    assert.deepEqual(await exchange({ invoke: api => api.getMe(), path: '/api/me', handler }), { userId: 'student', familyId: 'family', role, walletReady: false });
    db.finished();
  }
});

test('account status, enrollment and student-code contracts remain consumable', async () => {
  for (const [action, body, expected, status] of [
    ['status', undefined, { studentLinked: true }, 200],
    ['enroll', { role: 'parent' }, { enrolled: true }, 200],
    ['enroll', { role: 'student', code: 'a'.repeat(48) }, { enrolled: true }, 200],
    ['student-code', { email: 'child@example.test' }, null, 201],
  ]) {
    const db = database(action === 'status' ? [['family_members', member], ['family_members', { user_id: 'student' }]] : [], async name => {
      assert.equal(name, action === 'enroll' ? 'enroll_account' : 'create_student_setup_code');
      return { data: {} };
    });
    db.auth = { getUser: async () => ({ data: { user: { id: 'parent', email: 'parent@example.test', email_confirmed_at: stamp } } }) };
    const result = await exchange({ invoke: api => api.accountAction(action, body), path: `/api/accounts/${action}`, method: action === 'status' ? 'GET' : 'POST', body, handler: accounts, deps: { database: () => db }, status });
    if (expected) assert.deepEqual(result, expected);
    else { assert.match(result.code, /^[a-f0-9]{48}$/); assert.equal(result.expiresInHours, 24); }
    db.finished();
  }
});

test('family rules read/write and activity preserve consumed fields', async () => {
  const db = database([['family_rules', { revision: 1, settings: rules.settings, updated_at: stamp }], ['needs_purchases', [purchase]]], async name => {
    assert.ok(['save_family_rules', 'expire_purchase_reviews'].includes(name));
    return { data: { revision: 2, settings: rules.settings, updated_at: stamp } };
  });
  const deps = dependencies(db);
  const result = await exchange({ invoke: api => api.familyRules(), path: '/api/family/rules', handler: family, deps });
  assert.deepEqual({ revision: result.revision, settings: result.settings, updatedAt: result.updatedAt, buckets: result.activePurchaseBuckets }, { ...rules, buckets: ['needs', 'wants'] });
  assert.ok(result.categories.some(category => category.id === 'school_supplies'));
  assert.deepEqual(await exchange({ invoke: api => api.familyRules(rules.settings, 1), path: '/api/family/rules', method: 'PUT', body: { settings: rules.settings, expectedRevision: 1 }, handler: family, deps }), { revision: 2, settings: rules.settings, updatedAt: stamp });
  assert.deepEqual(await exchange({ invoke: api => api.activity(), path: '/api/family/activity', handler: family, deps }), { items: [{ id, status: 'claimed', reason: null, sellerId: 'demo-seller', priceMinor: '242', amountStroops: '2500000', bucket: 'needs', productName: 'Notebook', category: 'school_supplies', createdAt: stamp, photoPath: `/api/purchases/${id}/photo` }], limit: 100 });
  db.finished();
});

test('funding list and saved-revision replay retain both bucket amounts and hashes', async () => {
  const row = { id, status: 'confirmed', price_minor: '968', amount_stroops: '6000000', wants_stroops: '4000000', total_stroops: '10000000', rules_revision: 1, mapping_version: 'php-reference-2026-11-07', escrow_stroops: '6000000', created_at: stamp, steps: { fund: { hash: 'needs-hash' }, wantsFund: { hash: 'wants-hash' } } };
  const expected = { id, status: 'confirmed', priceMinor: '968', amountStroops: '6000000', wantsStroops: '4000000', totalStroops: '10000000', mappingVersion: row.mapping_version, escrowStroops: '6000000', createdAt: stamp, transactionHash: 'needs-hash', wantsTransactionHash: 'wants-hash' };
  const db = database([['needs_funding', [row]], ['needs_funding', row]]);
  const deps = { ...dependencies(db), ledger: () => ({ server: { httpClient: { defaults: {} } } }) };
  const list = await exchange({ invoke: api => api.funding(), path: '/api/allowance-funding', handler: funding, deps });
  assert.deepEqual(list, { operations: [expected], confirmedNeedsStroops: '6000000', confirmedWantsStroops: '4000000', fundingPriceMinor: '968', fundingAmountStroops: '10000000' });
  assert.deepEqual(await exchange({ invoke: api => api.funding('POST', id, 1), path: '/api/allowance-funding', method: 'POST', body: { expectedRevision: 1 }, key: id, handler: funding, deps }), expected);
  db.finished();
});

test('purchase lists, legacy/current submissions, claim and photo use existing client shapes', async () => {
  const db = database([
    ['needs_purchases', [purchase]], ['needs_funding', [{ amount_stroops: '6000000', wants_stroops: '4000000' }]], ['weekly_events', []],
    ['needs_purchases', purchase], ['needs_purchases', purchase], ['needs_purchases', purchase], ['needs_purchases', null], ['needs_purchases', purchase],
  ]);
  const deps = { ...dependencies(db, 'student'), loadRules: async () => rules };
  const list = await exchange({ invoke: api => api.purchases(), path: '/api/purchases', handler: purchases, deps });
  assert.deepEqual(list, { purchases: [expectedPurchase], rules: policy, wantsRules: purchaseRulesFromSettings(rules, 'wants'), availableNeedsStroops: '3500000', availableWantsStroops: '4000000' });
  for (const body of [payload, Object.fromEntries(Object.entries(payload).filter(([name]) => name !== 'bucket'))]) {
    assert.deepEqual(await exchange({ invoke: api => api.purchases('POST', body, id), path: '/api/purchases', method: 'POST', body, key: id, handler: purchases, deps }), expectedPurchase);
  }
  assert.deepEqual(await exchange({ invoke: api => api.purchases('POST', {}, undefined, `/${id}/claim`), path: `/api/purchases/${id}/claim`, method: 'POST', body: {}, handler: purchases, deps }), expectedPurchase);
  const signal = new AbortController().signal;
  const photo = await exchange({ invoke: api => api.purchasePhoto(id, signal), path: `/api/purchases/${id}/photo`, handler: purchases, deps, signal });
  assert.equal(photo.type, 'image/png');
  assert.equal(Buffer.from(await photo.arrayBuffer()).toString('base64'), payload.photoBase64);
  db.finished();
});

test('parent approval list, decision and continuation preserve consent and stage fields', async () => {
  const row = { ...purchase, status: 'rejected', parent_decision: { decision: 'reject' } };
  row.approval_binding = approvalBinding(row);
  const db = database([['needs_purchases', [row]], ['needs_purchases', row], ['needs_purchases', row]], async name => ({ data: name === 'expire_purchase_reviews' ? null : { row, admitted: false } }));
  const deps = dependencies(db);
  const expected = { ...expectedPurchase, status: 'rejected', parentDecision: { decision: 'reject' }, approvalBinding: row.approval_binding };
  assert.deepEqual(await exchange({ invoke: api => api.approvals(), path: '/api/purchases', handler: purchases, deps }), { purchases: [expected] });
  assert.deepEqual(await exchange({ invoke: api => api.approvals(id, 'reject', row.approval_binding), path: `/api/purchases/${id}/decision`, method: 'POST', body: { decision: 'reject', binding: row.approval_binding }, handler: purchases, deps }), expected);
  assert.deepEqual(await exchange({ invoke: api => api.executeApproval(id), path: `/api/purchases/${id}/execute`, method: 'POST', body: {}, handler: purchases, deps, status: 202 }), expected);
  db.finished();
});

test('weekly read, schedule update and terminal advance retain role-filtered balances', async () => {
  const clock = { simulated_at: stamp, revision: 1, weekday: 1, local_time: '09:00' };
  const event = { id, status: 'confirmed', stage: 6, stage_started: false, target_at: stamp, needs_stroops: '100', wants_stroops: '80', notice: null, steps: {} };
  const projected = { id, status: 'confirmed', stage: 6, stageStarted: false, targetAt: stamp, needsStroops: '100', notice: null, transactions: {} };
  for (const role of ['parent', 'student']) {
    const db = database([['weekly_clocks', null], ['weekly_clocks', clock], ['weekly_events', [event]]]);
    const result = await exchange({ invoke: api => api.weekly(), path: '/api/weekly', handler: weekly, deps: dependencies(db, role) });
    const { configured, ...rest } = result;
    assert.equal(typeof configured, 'boolean');
    assert.deepEqual(rest, { clock: { simulatedAt: stamp, revision: 1, weekday: 1, time: '09:00', timezone: 'Asia/Manila' }, events: [{ ...projected, ...(role === 'student' ? { wantsStroops: '80' } : {}) }], savingsStroops: '100', ...(role === 'student' ? { myMoneyStroops: '80' } : {}) });
    db.finished();
  }
  const db = database([['weekly_clocks', null], ['weekly_clocks', clock], ['weekly_clocks', null], ['weekly_clocks', clock], ['family_rules', { revision: 1, settings: rules.settings }], ['weekly_events', event]], async name => { assert.equal(name, 'save_weekly_schedule'); return { data: clock }; });
  const deps = { ...dependencies(db), ledger: () => ({}) };
  const body = { weekday: 1, time: '09:00', expectedRevision: 1 };
  assert.deepEqual(await exchange({ invoke: api => api.weekly('PUT', body), path: '/api/weekly', method: 'PUT', body, handler: weekly, deps }), { saved: true });
  assert.deepEqual(await exchange({ invoke: api => api.weekly('POST', { expectedRevision: 1 }, id), path: '/api/demo/advance', method: 'POST', body: { expectedRevision: 1 }, key: id, handler: weekly, deps }), projected);
  db.finished();
});

test('Velo list and legacy create replay preserve checkout presentation without credit', async () => {
  const row = { id, status: 'unknown', amount_stroops: '10000000', expected_receiver: 'synthetic-receiver', checkout_url: null, intent_id: null, created_at: stamp, rules_revision: 1 };
  const expected = { id, status: 'unknown', amountXlm: '1.0000000', expectedReceiver: row.expected_receiver, checkoutUrl: null, intentId: null, createdAt: stamp };
  const db = database([['velo_topups', [row]], ['velo_topups', row]]);
  const deps = { ...dependencies(db), receiver: () => row.expected_receiver, provider: () => { throw Error('Provider must not be called'); } };
  assert.deepEqual(await exchange({ invoke: api => api.veloTopups(), path: '/api/velo-topups', handler: veloTopups, deps }), { topups: [expected], expectedReceiver: row.expected_receiver });
  assert.deepEqual(await exchange({ invoke: api => api.veloTopups('POST', id, 1), path: '/api/velo-topups', method: 'POST', body: { expectedRevision: 1 }, key: id, handler: veloTopups, deps }), expected);
  db.finished();
});

// Use the production router here, not the isolated handler bridge, to catch lost routes.
for (const [path, method] of [
  ['/api/me', 'GET'], ['/api/accounts/status', 'GET'], ['/api/accounts/enroll', 'POST'], ['/api/accounts/student-code', 'POST'],
  ['/api/family/rules', 'GET'], ['/api/family/rules', 'PUT'], ['/api/family/activity', 'GET'],
  ['/api/allowance-funding', 'GET'], ['/api/allowance-funding', 'POST'], ['/api/velo-topups', 'GET'], ['/api/velo-topups', 'POST'],
  ['/api/weekly', 'GET'], ['/api/weekly', 'PUT'], ['/api/demo/advance', 'POST'], ['/api/purchases', 'GET'], ['/api/purchases', 'POST'],
  ...['decision', 'execute', 'claim'].map(action => [`/api/purchases/${id}/${action}`, 'POST']), [`/api/purchases/${id}/photo`, 'GET'],
]) test(`production router preserves ${method} ${path} and the unauthenticated error envelope`, async () => {
  let result;
  await router({ url: path, method, headers: {} }, { setHeader() {}, end(raw) { result = JSON.parse(raw); }, set statusCode(value) { assert.equal(value, 401); } });
  assert.equal(result.error.code, 'UNAUTHENTICATED');
  assert.equal(typeof result.error.message, 'string');
  assert.equal(typeof result.error.retryable, 'boolean');
});

test('real handler error envelopes remain ApiError code/message/retryable values', async () => {
  const deny = async () => { throw Object.assign(Error('Sign in required.'), { status: 401, code: 'UNAUTHENTICATED' }); };
  for (const [invoke, path, handler] of [
    [api => api.familyRules(), '/api/family/rules', family], [api => api.activity(), '/api/family/activity', family],
    [api => api.funding(), '/api/allowance-funding', funding], [api => api.purchases(), '/api/purchases', purchases],
    [api => api.approvals(), '/api/purchases', purchases], [api => api.weekly(), '/api/weekly', weekly],
    [api => api.veloTopups(), '/api/velo-topups', veloTopups],
  ]) await assert.rejects(exchange({ invoke, path, handler, deps: { authenticate: deny }, status: 401 }), error => error instanceof ApiError && error.code === 'UNAUTHENTICATED' && error.message === 'UNAUTHENTICATED' && error.retryable === false);
});
