import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAppController } from '../src/app/controller.js';

const make = ({ signIn = async () => ({ mock: true, user: { role: 'parent' } }), api = { injectExampleError: async () => { const e = new Error('Sample unavailable'); e.code = 'PROVIDER_UNAVAILABLE'; e.retryable = true; throw e; } } } = {}) => createAppController({ auth: { signIn }, api });

test('sign-in publishes loading then role-specific ready state', async () => {
  let finish;
  const controller = make({ signIn: () => new Promise((resolve) => { finish = resolve; }) });
  const states = [];
  controller.subscribe((state) => states.push(state.status));
  const pending = controller.signIn({ email: 'demo@example.com', password: 'not-retained' });
  assert.equal(controller.getState().status, 'loading');
  finish({ mock: true, user: { role: 'student' } });
  await pending;
  assert.deepEqual(states, ['idle', 'loading', 'ready']);
  assert.equal(controller.getState().user.role, 'student');
});

test('sign-in errors return to the form and expose a stable error state', async () => {
  const error = Object.assign(new Error('Synthetic service error'), { code: 'PROVIDER_UNAVAILABLE', retryable: true });
  const controller = make({ signIn: async () => { throw error; } });
  await controller.signIn({ email: 'demo@example.com', password: 'x' });
  assert.equal(controller.getState().screen, 'signin');
  assert.equal(controller.getState().status, 'error');
  assert.deepEqual(controller.getState().error, { code: 'PROVIDER_UNAVAILABLE', message: 'Synthetic service error', retryable: true });
});

test('error fixture can be projected into the shell and signed-out state clears identity', async () => {
  const controller = make();
  await controller.signIn({ email: 'demo@example.com', password: 'x' });
  await controller.triggerExampleError();
  assert.equal(controller.getState().status, 'error');
  assert.equal(controller.getState().error.retryable, true);
  await controller.signOut();
  assert.equal(controller.getState().screen, 'signin');
  assert.equal(controller.getState().user, null);
});

test('shell sample error loading can be observed and dismissed without reinjecting the same error', async () => {
  let finish;
  const controller = make({ api: { injectExampleError: () => new Promise((_, reject) => { finish = reject; }) } });
  await controller.signIn({ email: 'demo@example.com', password: 'x' });
  const pending = controller.triggerExampleError();
  assert.equal(controller.getState().status, 'loading');
  finish(Object.assign(new Error('Synthetic service error'), { code: 'PROVIDER_UNAVAILABLE', retryable: true }));
  await pending;
  assert.equal(controller.getState().status, 'error');
  controller.dismissError();
  assert.equal(controller.getState().status, 'ready');
  assert.equal(controller.getState().error, null);
});

test('duplicate submits while loading do not call auth twice', async () => {
  let resolve;
  let count = 0;
  const controller = make({ signIn: () => { count += 1; return new Promise((done) => { resolve = done; }); } });
  const first = controller.signIn({ email: 'a@b.com', password: 'x' });
  await controller.signIn({ email: 'a@b.com', password: 'x' });
  assert.equal(count, 1);
  resolve({ mock: true, user: { role: 'parent' } });
  await first;
});
