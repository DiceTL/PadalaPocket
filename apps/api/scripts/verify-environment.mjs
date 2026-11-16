import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { createServer } from 'node:http';
import { handler } from '../src/router.mjs';
import { localConfiguration, assertLoopbackBindings, options, emails, command, project, root } from './local-verification.mjs';

// Real local Auth/Postgres acceptance only; no provider or financial calls.
let step = 'local-configuration';
async function verify() {
  const { status, admin, password } = await localConfiguration();
  assertLoopbackBindings();
  step = 'migration-history';
  const expectedMigrations = (await readdir(new URL('supabase/migrations/', root))).filter(name => name.endsWith('.sql')).map(name => name.split('_')[0]).sort();
  const applied = command('docker', ['exec', `supabase_db_${project}`, 'psql', '-U', 'postgres', '-d', 'postgres', '-At', '-c', 'select version from supabase_migrations.schema_migrations order by version']).trim().split('\n');
  assert.deepEqual(applied, expectedMigrations);
  const sessions = [];
  step = 'verification-signin';
  for (const email of emails) {
    const client = createClient(status.API_URL, status.ANON_KEY, options);
    const login = await client.auth.signInWithPassword({ email, password: password(email) });
    assert.equal(login.error, null);
    const membership = await client.from('family_members').select('user_id,family_id,role,wallet_ready').single();
    assert.equal(membership.error, null);
    assert.equal(membership.data.user_id, login.data.user.id);
    assert.equal(membership.data.role, email.includes('-parent-') ? 'parent' : 'student');
    assert.equal(membership.data.wallet_ready, false);
    sessions.push({ client, email, token: login.data.session.access_token, member: membership.data });
  }
  assert.equal(sessions[0].member.family_id, sessions[1].member.family_id);
  assert.equal(sessions[2].member.family_id, sessions[3].member.family_id);
  assert.notEqual(sessions[0].member.family_id, sessions[2].member.family_id);
  step = 'operator-and-family-access';
  const anonymous = createClient(status.API_URL, status.ANON_KEY, options);
  assert.ok((await anonymous.from('family_members').select('*')).error);
  assert.ok((await anonymous.auth.admin.listUsers()).error);
  for (const { client, member } of sessions) {
    assert.ok((await client.auth.admin.listUsers()).error);
    assert.ok((await client.from('family_members').update({ role: member.role }).eq('user_id', member.user_id)).error);
    assert.ok((await client.rpc('enroll_account', { p_user: member.user_id })).error);
    const other = sessions.find(session => session.member.family_id !== member.family_id);
    const crossFamily = await client.from('family_members').select('*').eq('family_id', other.member.family_id);
    assert.equal(crossFamily.error, null);
    assert.deepEqual(crossFamily.data, []);
  }
  assert.equal((await admin.auth.admin.listUsers()).error, null);
  for (const table of ['needs_funding', 'needs_purchases', 'family_rules', 'velo_topups', 'weekly_events', 'student_setup_codes']) {
    assert.equal((await admin.from(table).select('*').limit(0)).error, null);
    for (const client of [anonymous, ...sessions.map(session => session.client)]) {
      assert.ok((await client.from(table).select('*').limit(0)).error);
    }
  }
  step = 'api-contract-and-secret-isolation';

  // Only the isolated API process receives the local service credential.
  process.env.SUPABASE_URL = status.API_URL;
  process.env.SUPABASE_PUBLISHABLE_KEY = status.ANON_KEY;
  process.env.SUPABASE_SECRET_KEY = status.SERVICE_ROLE_KEY;
  const server = createServer(handler);
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    for (const session of sessions) {
      const response = await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${session.token}` } });
      assert.equal(response.status, 200);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      const text = await response.text();
      for (const secret of [status.SERVICE_ROLE_KEY, session.token, password(session.email)]) assert.equal(text.includes(secret), false);
      assert.deepEqual(JSON.parse(text), { userId: session.member.user_id, familyId: session.member.family_id, role: session.member.role, walletReady: false });
      const gated = await fetch(`${base}/api/allowance-funding`, { headers: { Authorization: `Bearer ${session.token}` } });
      assert.equal(gated.status, 409);
      assert.equal((await gated.json()).error.code, 'WALLET_SETUP_REQUIRED');
    }
    assert.equal((await fetch(`${base}/api/me`)).status, 401);
    assert.equal((await fetch(`${base}/api/operator/proof`)).status, 404);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}
try {
  await verify();
  console.log('PASS: environment');
} catch {
  // Never emit provider responses, credentials or assertion values.
  console.error(`FAIL: environment (${step})`);
  process.exitCode = 1;
}
