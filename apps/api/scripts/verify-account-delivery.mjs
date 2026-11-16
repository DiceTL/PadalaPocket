import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { setTimeout } from 'node:timers/promises';
import { accountDeliveryContext, canonicalSiteConfiguration, deployedRequest, appUrl, assertFreshIdentityFixtures, readCallbackEvidence, validateCallbackEvidence } from './account-delivery-context.mjs';

let stage = 'configuration';
try {
  const context = await accountDeliveryContext();
  canonicalSiteConfiguration(context.projectRef);
  const { admin, emails, password, publicClient, users } = context;
  stage = 'approved-test-accounts';
  for (const email of emails) assert.ok(users.has(email), 'SIGNUP_REQUIRED');
  const [parentUser, studentUser] = emails.map(email => users.get(email));
  stage = 'fresh-unenrolled-fixtures';
  await assertFreshIdentityFixtures(admin, [parentUser, studentUser]);

  // Send one genuine replacement confirmation before the owner opens the latest email.
  stage = 'resend';
  if (!parentUser.email_confirmed_at) {
    const earliest = Date.parse(parentUser.confirmation_sent_at ?? parentUser.created_at) + 61000;
    if (earliest > Date.now()) await setTimeout(earliest - Date.now());
    const resend = await publicClient().auth.resend({ type: 'signup', email: emails[0], options: { emailRedirectTo: `${appUrl}/?accountType=parent` } });
    assert.equal(resend.error, null);
  }
  stage = 'real-inbox-confirmation';
  const deadline = Date.now() + 10 * 60 * 1000;
  for (const user of [parentUser, studentUser]) {
    while (!user.email_confirmed_at && Date.now() < deadline) {
      await setTimeout(5000);
      const result = await admin.auth.admin.getUserById(user.id);
      assert.equal(result.error, null);
      Object.assign(user, result.data.user);
    }
    assert.ok(user.email_confirmed_at, 'INBOX_CONFIRMATION_REQUIRED');
  }
  stage = 'explicit-callback-evidence';
  validateCallbackEvidence(await readCallbackEvidence(process.stdin), [parentUser, studentUser]);

  stage = 'signin-and-authorization';
  const sessions = [];
  for (const email of emails) {
    const client = publicClient();
    const invalid = await client.auth.signInWithPassword({ email, password: password(email) + '-wrong' });
    assert.ok(invalid.error);
    assert.equal(invalid.data.session, null);
    const valid = await client.auth.signInWithPassword({ email, password: password(email) });
    assert.equal(valid.error, null);
    assert.ok(valid.data.session?.access_token);
    sessions.push(valid.data.session.access_token);
  }
  const [parentToken, studentToken] = sessions;
  const anonymous = await deployedRequest('/api/accounts/status');
  assert.equal(anonymous.status, 401);
  assert.equal(anonymous.body.error.code, 'UNAUTHENTICATED');
  const forged = await deployedRequest('/api/accounts/enroll', parentToken, 'POST', { role: 'parent', userId: studentUser.id });
  assert.equal(forged.status, 400);
  assert.equal(forged.body.error.code, 'INVALID_INPUT');

  stage = 'parent-enrollment';
  assert.equal((await deployedRequest('/api/accounts/enroll', parentToken, 'POST', { role: 'parent' })).status, 200);
  const parent = await deployedRequest('/api/me', parentToken);
  assert.equal(parent.status, 200);
  assert.equal(parent.body.role, 'parent');
  assert.equal(parent.body.walletReady, false);
  const studentBefore = await deployedRequest('/api/me', studentToken);

  assert.equal(studentBefore.status, 403, 'FRESH_UNENROLLED_FIXTURES_REQUIRED');
  {
    assert.equal(studentBefore.body.error.code, 'ACCOUNT_SETUP_REQUIRED');
    const createCode = async email => {
      const result = await deployedRequest('/api/accounts/student-code', parentToken, 'POST', { email });
      assert.equal(result.status, 201);
      assert.match(result.body.code, /^[a-f0-9]{48}$/);
      return result.body.code;
    };
    const enroll = code => deployedRequest('/api/accounts/enroll', studentToken, 'POST', { role: 'student', code });
    const rejected = async code => {
      const result = await enroll(code);
      assert.equal(result.status, 409);
      assert.equal(result.body.error.code, 'INVALID_OR_EXPIRED_CODE');
    };
    stage = 'wrong-email-code';
    await rejected(await createCode(`wrong-${studentUser.id}@example.invalid`));

    // Only mutate the freshly generated invitation in this tagged, unfunded test family.
    const changeCode = async (code, patch) => {
      const result = await admin.from('student_setup_codes').update(patch).eq('family_id', parent.body.familyId).eq('email', emails[1]).eq('token_hash', createHash('sha256').update(code).digest('hex')).select('family_id').single();
      assert.equal(result.error, null);
      assert.equal(result.data.family_id, parent.body.familyId);
    };
    stage = 'expired-code';
    const expired = await createCode(emails[1]);
    await changeCode(expired, { expires_at: '2000-01-01T00:00:00Z' });
    await rejected(expired);
    stage = 'consumed-code';
    const consumed = await createCode(emails[1]);
    await changeCode(consumed, { consumed_by: parentUser.id });
    await rejected(consumed);
    stage = 'student-enrollment';
    const valid = await createCode(emails[1]);
    assert.equal((await enroll(valid)).status, 200);
    // Replaying an already-enrolled member is deliberately idempotent, not another join.
    assert.equal((await enroll(valid)).status, 200);
  }

  stage = 'trusted-linked-identity';
  const student = await deployedRequest('/api/me', studentToken);
  assert.equal(student.status, 200);
  assert.equal(student.body.role, 'student');
  assert.equal(student.body.familyId, parent.body.familyId);
  assert.equal(student.body.walletReady, false);
  const status = await deployedRequest('/api/accounts/status', parentToken);
  assert.equal(status.status, 200);
  assert.equal(status.body.studentLinked, true);
  const relink = await deployedRequest('/api/accounts/student-code', parentToken, 'POST', { email: emails[1] });
  assert.equal(relink.status, 409);
  assert.equal(relink.body.error.code, 'STUDENT_ALREADY_LINKED');
  const forbiddenCode = await deployedRequest('/api/accounts/student-code', studentToken, 'POST', { email: emails[0] });
  assert.equal(forbiddenCode.status, 409);
  assert.equal(forbiddenCode.body.error.code, 'SETUP_CODE_UNAVAILABLE');
  assert.equal((await deployedRequest('/api/purchases', studentToken)).body.error.code, 'WALLET_SETUP_REQUIRED');
  console.log('PASS: identity');
} catch {
  console.error(`FAIL: identity (${stage})`);
  process.exitCode = 1;
}
