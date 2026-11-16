import assert from 'node:assert/strict';
import { accountDeliveryContext, canonicalSiteConfiguration, appUrl, taskTag, assertFreshIdentityFixtures } from './account-delivery-context.mjs';

// Explicitly approved T04 setup only; no deletion, password reset or auto-confirmation.
let stage = 'approval';
try {
  assert.equal(process.argv[2], '--run');
  assert.equal(process.argv.length, 3);
  stage = 'private-configuration';
  const { admin, projectRef, users, emails, publicClient, password } = await accountDeliveryContext();
  if (users.size) await assertFreshIdentityFixtures(admin, [...users.values()]);
  stage = 'canonical-confirmation-configuration';
  canonicalSiteConfiguration(projectRef, true);
  canonicalSiteConfiguration(projectRef);
  for (let index = 0; index < emails.length; index++) {
    const email = emails[index];
    if (users.has(email)) continue;
    const role = index === 0 ? 'parent' : 'student';
    stage = `${role}-signup`;
    const client = publicClient();
    const signup = await client.auth.signUp({ email, password: password(email), options: { emailRedirectTo: `${appUrl}/?accountType=${role}`, data: { verification_task: taskTag } } });
    assert.equal(signup.error, null);
    assert.ok(signup.data.user?.id);
    assert.equal(signup.data.session, null);
    assert.ok(!signup.data.user.email_confirmed_at);
    stage = `${role}-pending-verification-denial`;
    const pending = await client.auth.signInWithPassword({ email, password: password(email) });
    assert.equal(pending.error?.code, 'email_not_confirmed');
    assert.equal(pending.data.session, null);
  }
  console.log('PASS: approved identity preparation');
} catch {
  console.error(`FAIL: approved identity preparation (${stage})`);
  process.exitCode = 1;
}
