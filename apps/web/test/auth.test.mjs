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

test('live sign-in reports missing provider configuration', async () => {
  const auth = createAuthBoundary({ mode: 'live', api: { getMe: async () => ({ role: 'parent' }) } });
  await assert.rejects(auth.signIn({ email: 'a@example.test', password: 'secret' }), /Sign-in service is unavailable/);
});


test('live sign-in verifies credentials and loads the trusted API projection', async () => {
  const calls = [];
  const auth = createAuthBoundary({ mode: 'live',
    supabase: { auth: { signInWithPassword: async (input) => { calls.push(input); return {}; }, signOut: async () => {} } },
    api: { getMe: async () => ({ role: 'student' }) } });
  assert.deepEqual(await auth.signIn({ email: ' student@example.test ', password: 'test' }), { mock: false, user: { role: 'student' } });
  assert.deepEqual(calls, [{ email: 'student@example.test', password: 'test' }]);
});


test('sign-out affects only the current session', async () => {
  const calls = [];
  const auth = createAuthBoundary({ mode: 'live', api: {}, supabase: { auth: { signOut: async options => calls.push(options) } } });
  await auth.signOut();
  assert.deepEqual(calls, [{ scope: 'local' }]);
});
