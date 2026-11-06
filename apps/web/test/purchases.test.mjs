import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/client/api.js';
import { createAppController } from '../src/app/controller.js';
test('live purchase client sends the frozen payload, bearer and idempotency key', async () => {
  const calls = []; const payload = { sellerId: 'demo-seller', priceMinor: '242', mime: 'image/png', photoBase64: 'test' };
  const api = createApiClient({ mode: 'live', getAccessToken: async () => 'token', fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ status: 'merchant_pending' }) }; } });
  assert.equal((await api.purchases('POST', payload, 'key')).status, 'merchant_pending');
  assert.equal(calls[0].url, '/api/purchases'); assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'key'); assert.deepEqual(JSON.parse(calls[0].options.body), payload);
});
test('student reload restores real purchase history; explicit claim reloads backend status', async () => {
  let status = 'merchant_pending'; let claims = 0;
  const controller = createAppController({ auth: { mode: 'live' }, api: { mode: 'live', getMe: async () => ({ userId: 'student', role: 'student' }), purchases: async (method, _, key, suffix) => {
    if (method === 'POST') { assert.equal(suffix, '/purchase/claim'); assert.equal(key, undefined); claims++; status = 'claimed'; return { status }; }
    return { purchases: [{ id: 'purchase', status }] };
  } } });
  await controller.restore(); assert.equal(controller.getState().purchaseHistory.purchases[0].status, 'merchant_pending');
  await controller.claimPurchase('purchase'); assert.equal(claims, 1); assert.equal(controller.getState().purchaseHistory.purchases[0].status, 'claimed');
});
test('mock purchase client cannot silently call the live endpoint', async () => {
  const api = createApiClient({ mode: 'mock', fetchImpl: () => assert.fail('live request') }); await assert.rejects(api.purchases(), /live API/);
});
