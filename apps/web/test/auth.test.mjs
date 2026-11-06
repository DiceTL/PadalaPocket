import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAuthBoundary } from '../src/auth/auth-boundary.js';

test('mock sign-in requires nonempty fields but leaves credential verification to no provider', async () => {
  let calls = 0;
  const auth = createAuthBoundary({ mode: 'mock', api: { getMe: async () => { calls += 1; return { role: 'parent' }; } } });
  const result = await auth.signIn({ email: 'anything@example.test', password: 'any value' });
  assert.deepEqual(result, { mock: true, user: { role: 'parent' } });
  assert.equal(calls, 1);
  await assert.rejects(auth.signIn({ email: '', password: '' }), { code: 'INVALID_INPUT' });
});

test('live sign-in fails transparently until an Auth contract is implemented', async () => {
  const auth = createAuthBoundary({ mode: 'live', api: { getMe: async () => ({ role: 'parent' }) } });
  await assert.rejects(auth.signIn({ email: 'a@example.test', password: 'secret' }), /Live authentication is not implemented/);
});
