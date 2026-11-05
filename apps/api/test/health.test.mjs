import { test } from 'node:test';
import assert from 'node:assert/strict';
import { handler } from '../src/health.mjs';
function call(url, method = 'GET') {
  const headers = {};
  const res = { setHeader(key, value) { headers[key] = value; }, end(body) { this.body = JSON.parse(body); } };
  handler({ url, method }, res);
  return { ...res, headers };
}
test('health reports Testnet and runtime without environment secrets', () => {
  const previous = process.env.VELO_API_KEY;
  process.env.VELO_API_KEY = 'test-secret-do-not-return';
  try {
    const res = call('/api/health');
    assert.equal(res.statusCode, 200);
    assert.deepEqual(res.body, { status: 'ok', network: 'testnet', runtime: process.version });
    assert.equal(res.headers['Cache-Control'], 'no-store');
  } finally {
    if (previous === undefined) delete process.env.VELO_API_KEY;
    else process.env.VELO_API_KEY = previous;
  }
});
test('unknown paths return 404 rather than health success', () => {
  assert.equal(call('/api/purchases').statusCode, 404);
});
test('health accepts only GET', () => {
  const res = call('/api/health', 'POST');
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, 'GET');
});
