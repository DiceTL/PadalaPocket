import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getRoleView, MOCK_BADGE_TEXT, MOCK_DISCLOSURE } from '../src/views/model.js';

test('parent shell navigation excludes private My Money', () => {
  const view = getRoleView({ role: 'parent' });
  assert.deepEqual(view.navigation, ['Overview', 'Allowance rules', 'Approvals', 'Activity', 'Savings', 'Deposit']);
  assert.equal(view.navigation.includes('My Money'), false);
});

test('student shell exposes its own My Money view from the student identity', () => {
  const view = getRoleView({ role: 'student' });
  assert.deepEqual(view.navigation, ['Home', 'Activity', 'Savings', 'My Money']);
  assert.match(view.message, /no approved layout/);
});

test('unsupported roles fail closed', () => {
  assert.throws(() => getRoleView({ role: 'admin' }), /not supported/);
});

test('mock mode disclosures clearly state the simulation and credential behavior', () => {
  assert.match(MOCK_BADGE_TEXT, /MOCK DATA/);
  assert.match(MOCK_BADGE_TEXT, /development mode/);
  assert.match(MOCK_DISCLOSURE, /Credentials are not checked or saved/);
  assert.match(MOCK_DISCLOSURE, /configured mock identity/);
});
