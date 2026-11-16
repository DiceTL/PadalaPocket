import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import * as context from '../scripts/account-delivery-context.mjs';

const users = ['parent-user', 'student-user'].map(id => ({ id, created_at: '2026-11-16T00:00:00Z', email_confirmed_at: '2026-11-16T00:01:00Z' }));
const now = Date.parse('2026-11-16T00:03:00Z');
const observation = user => ({ userId: user.id, origin: context.appUrl, outcome: 'setup', observedAt: '2026-11-16T00:02:00Z' });
const evidence = () => ({ parent: observation(users[0]), student: observation(users[1]) });
const database = memberships => ({ from() { let id; return { select() { return this; }, eq(_field, value) { id = value; return this; }, async maybeSingle() { return { data: memberships[id] ?? null }; } }; } });

test('fresh identity fixtures permit all enrollment cases only while both are unenrolled', async () => {
  await context.assertFreshIdentityFixtures(database({}), users);
  for (const user of users) {
    await assert.rejects(context.assertFreshIdentityFixtures(database({ [user.id]: { user_id: user.id } }), users), /FRESH_UNENROLLED_FIXTURES_REQUIRED/);
  }
});

test('confirmation state alone and student-only callback evidence cannot close the inbox journey', () => {
  assert.throws(() => context.validateCallbackEvidence(undefined, users, now));
  assert.throws(() => context.validateCallbackEvidence({ student: observation(users[1]) }, users, now));
  assert.doesNotThrow(() => context.validateCallbackEvidence(evidence(), users, now));
});

test('callback evidence rejects failed links, wrong account/origin, stale evidence and future observations', () => {
  for (const patch of [
    { outcome: 'invalid_or_expired' }, { userId: 'previous-parent' },
    { origin: 'http://localhost:5174' }, { origin: context.appUrl + '/?access_token=untrusted' },
    { observedAt: '2026-11-15T23:59:00Z' }, { observedAt: '2026-11-16T01:00:00Z' },
    { observedAt: 'invalid-date' }, { token: 'not-permitted' },
  ]) {
    const value = evidence();
    value.parent = { ...value.parent, ...patch };
    assert.throws(() => context.validateCallbackEvidence(value, users, now));
  }
});

test('fixture database errors and empty fixture sets cannot be treated as fresh', async () => {
  await assert.rejects(context.assertFreshIdentityFixtures(database({}), []));
  const failed = { from() { return { select() { return this; }, eq() { return this; }, async maybeSingle() { return { data: null, error: { code: 'unavailable' } }; } }; } };
  await assert.rejects(context.assertFreshIdentityFixtures(failed, users));
});

test('callback input requires bounded valid JSON rather than an implicit confirmation flag', async () => {
  assert.deepEqual(await context.readCallbackEvidence(Readable.from([JSON.stringify(evidence())])), evidence());
  for (const raw of ['', 'invalid-json', ' '.repeat(4097)]) {
    await assert.rejects(context.readCallbackEvidence(Readable.from([raw])));
  }
});
