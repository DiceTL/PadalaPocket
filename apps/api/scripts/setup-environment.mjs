import assert from 'node:assert/strict';
import { command, project, localConfiguration, assertLoopbackBindings, assertLocalProject, emails } from './local-verification.mjs';

// Explicit operator action: local containers, migrations and synthetic Auth only.
// Never call this from the done-check or the normal application startup.
let step = 'network';
try {
  await assertLocalProject();
  const networks = command('docker', ['network', 'ls', '--filter', `name=^${project}$`, '--format', '{{.Name}}']).trim();
  if (!networks) command('docker', ['network', 'create', '--driver', 'bridge', '--opt', 'com.docker.network.bridge.host_binding_ipv4=127.0.0.1', project]);
  const network = JSON.parse(command('docker', ['network', 'inspect', '--format', '{{json .Options}}', project]));
  assert.equal(network['com.docker.network.bridge.host_binding_ipv4'], '127.0.0.1');
  step = 'local-start';
  command('supabase', ['start', '--network-id', project], 900000);
  step = 'local-bindings';
  assertLoopbackBindings();
  step = 'local-migrations';
  command('supabase', ['migration', 'up', '--local'], 120000);
  step = 'verification-identities';
  const { admin, password } = await localConfiguration();
  const users = new Map();
  for (let page = 1; ; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    assert.equal(result.error, null);
    for (const user of result.data.users) users.set(user.email, user);
    if (result.data.users.length < 100) break;
  }
  for (let pair = 0; pair < 2; pair++) {
    const familyId = `00000000-0000-4000-8000-00000000000${pair + 1}`;
    for (const [offset, role] of [[0, 'parent'], [1, 'student']]) {
      const email = emails[pair * 2 + offset];
      let user = users.get(email);
      if (!user) {
        const result = await admin.auth.admin.createUser({ email, password: password(email), email_confirm: true });
        assert.equal(result.error, null);
        user = result.data.user;
      }
      const existing = await admin.from('family_members').select('*').eq('user_id', user.id).maybeSingle();
      assert.equal(existing.error, null);
      if (existing.data) {
        assert.equal(existing.data.family_id, familyId);
        assert.equal(existing.data.role, role);
        assert.equal(existing.data.wallet_ready, false);
      } else {
        const inserted = await admin.from('family_members').insert({ user_id: user.id, family_id: familyId, role, wallet_ready: false });
        assert.equal(inserted.error, null);
      }
    }
  }
  console.log('PASS: local environment setup');
} catch {
  console.error(`FAIL: local environment setup (${step})`);
  process.exitCode = 1;
}
