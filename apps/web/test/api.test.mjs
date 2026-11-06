import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, getFixture, ApiError } from '../src/client/api.js';

test('mock identity consumes the stable direct S-002 body without adding an envelope', async () => {
  const body = await createApiClient().getMe();
  assert.deepEqual(Object.keys(body).sort(), ['familyId', 'role', 'userId']);
  assert.equal(body.role, 'parent');
});

test('identity role is sourced from the configured read-only fixture', async () => {
  const student = await createApiClient({ identityFixtureName: 'student-identity' }).getMe();
  assert.equal(student.role, 'student');
  assert.equal(getFixture('student-identity', 'identity').mock, 'MOCK');
});

test('fixture validation rejects missing names and mismatched kinds', () => {
  assert.throws(() => getFixture('unknown'), /Unknown mock fixture/);
  assert.throws(() => getFixture('parent-identity', 'error'), /expected error/);
});

test('generic S-002 error remains endpoint-agnostic and retryable flag is preserved', async () => {
  const api = createApiClient();
  await assert.rejects(api.injectExampleError(), (error) => {
    assert.ok(error instanceof ApiError);
    assert.equal(error.code, 'PROVIDER_UNAVAILABLE');
    assert.equal(error.retryable, true);
    assert.equal(error.status, 503);
    return true;
  });
  const fixture = getFixture('error-PROVIDER_UNAVAILABLE', 'error');
  assert.equal(fixture.path, null);
});

test('live identity requests the documented route and parses stable error envelope', async () => {
  let requested;
  const api = createApiClient({ mode: 'live', fetchImpl: async (path, options) => {
    requested = [path, options.headers.Accept];
    return { ok: false, status: 401, json: async () => ({ error: { code: 'UNAUTHENTICATED', message: 'Sign in required.', retryable: false } }) };
  } });
  await assert.rejects(api.getMe(), (error) => error.code === 'UNAUTHENTICATED' && error.status === 401);
  assert.deepEqual(requested, ['/api/me', 'application/json']);
});
