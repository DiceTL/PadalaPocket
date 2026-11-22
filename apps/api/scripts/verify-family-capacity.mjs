import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import { createServer, request } from 'node:http';
import { once } from 'node:events';
import pg from 'pg';
import { createClient } from '@supabase/supabase-js';
import { Keypair } from '@stellar/stellar-sdk';
import { accounts } from '../src/accounts.mjs';
import { createIdentityHandler } from '../src/identity.mjs';
import { isFinancialPath, proxyFinancial } from '../src/money-proxy.mjs';
import { createIsolatedFinancialHandler } from '../src/money-coordinator-handler.mjs';
import { veloTopups } from '../src/velo-topups.mjs';
import { assertLoopbackBindings, localConfiguration, options } from './local-verification.mjs';

let pool, server, stage = 'loopback';
let passed = false, temporaryRoleGrant = false;
const familyIds = [], userIds = [];
const runId = randomUUID();
const email = name => `capacity-${runId}-${name}@example.test`;
const claim = 'select wallet_custody.claim_family_slot($1,$2) as slot';
async function scoped(role, sql, params) {
  const client = await pool.connect();
  try {
    await client.query('begin');
    await client.query(`set local role ${role}`);
    const result = await client.query(sql, params);
    await client.query('commit');
    return result.rows[0]?.slot;
  } finally {
    try { await client.query('rollback'); } finally { client.release(); }
  }
}

try {
  const { status, admin, password } = await localConfiguration();
  assertLoopbackBindings();
  const database = new URL(status.DB_URL);
  assert.equal(database.protocol, 'postgresql:');
  assert.equal(database.host, '127.0.0.1:54332');
  assert.equal(database.pathname, '/postgres');
  pool = new pg.Pool({ connectionString: status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000, max: 16 });
  stage = 'capacity-boundary-installed';
  const initial = await pool.query('select count(*)::int as n from wallet_custody.family_capacity_slots');
  const access = await pool.query("select pg_has_role(current_user,'family_provision_worker','SET') as able");
  if (!access.rows[0].able) {
    await pool.query('grant family_provision_worker to postgres with set true, inherit false');
    temporaryRoleGrant = true;
  }
  const occupied = initial.rows[0].n;
  // Local fixtures must leave room to show that at least one independently linked family can claim a slot.
  assert.ok(occupied < 10);

  const env = { SUPABASE_URL: status.API_URL, SUPABASE_PUBLISHABLE_KEY: status.ANON_KEY, SUPABASE_SECRET_KEY: status.SERVICE_ROLE_KEY };
  Object.assign(process.env, env);
  const identity = createIdentityHandler({ env });
  const token = randomBytes(32).toString('hex');
  const coordinator = createIsolatedFinancialHandler({ token, database: admin });
  server = createServer((req, res) => {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (path.startsWith('/api/accounts/')) return accounts(req, res);
    if (req.headers['x-money-coordinator-token']) return coordinator(req, res);
    if (path === '/api/velo-topups') return veloTopups(req, res);
    if (isFinancialPath(path)) return proxyFinancial(req, res, { env });
    return identity(req, res);
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const http = (bearer, path, body, internal = false) => new Promise((resolve, reject) => {
    const req = request({ hostname: '127.0.0.1', port: server.address().port, path,
      method: body ? 'POST' : 'GET', signal: AbortSignal.timeout(10000),
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json',
        ...(internal && { 'x-money-coordinator-token': token }) },
    }, async res => {
      try {
        let raw = '';
        for await (const chunk of res) raw += chunk;
        resolve({ status: res.statusCode, body: JSON.parse(raw) });
      } catch (error) { reject(error); }
    });
    req.on('error', reject);
    req.end(body ? JSON.stringify(body) : undefined);
  });
  async function login(name) {
    const address = email(name), secret = password(address);
    const created = await admin.auth.admin.createUser({ email: address, password: secret, email_confirm: true });
    assert.equal(created.error, null);
    userIds.push(created.data.user.id);
    const auth = createClient(status.API_URL, status.ANON_KEY, options);
    const session = await auth.auth.signInWithPassword({ email: address, password: secret });
    assert.equal(session.error, null);
    return { id: created.data.user.id, token: session.data.session.access_token };
  }
  async function linked(name, beforeLink) {
    const parent = await login(`${name}-parent`);
    assert.equal((await http(parent.token, '/api/accounts/enroll', { role: 'parent' })).status, 200);
    const me = await http(parent.token, '/api/me');
    assert.equal(me.status, 200);
    const family = me.body.familyId;
    familyIds.push(family);
    await beforeLink?.(parent.id, family);
    const invite = await http(parent.token, '/api/accounts/student-code', { email: email(`${name}-student`) });
    assert.equal(invite.status, 201);
    const student = await login(`${name}-student`);
    assert.equal((await http(student.token, '/api/accounts/enroll', { role: 'student', code: invite.body.code })).status, 200);
    assert.deepEqual(await http(parent.token, '/api/accounts/status'), { status: 200, body: { studentLinked: true } });
    return { family, parent, student };
  }
  stage = 'linked-family-only-and-private-role';
  const partial = await linked('partial', async (actor, family) => {
    await assert.rejects(scoped('family_provision_worker', claim, [actor, family]), { message: 'PROVISION_FORBIDDEN' });
  });
  await assert.rejects(scoped('authenticated', claim, [partial.parent.id, partial.family]), { code: '42501' });
  await assert.rejects(scoped('service_role', claim, [partial.parent.id, partial.family]), { code: '42501' });
  await assert.rejects(scoped('family_provision_worker', claim, [partial.student.id, partial.family]), { message: 'PROVISION_FORBIDDEN' });
  const slot = await scoped('family_provision_worker', claim, [partial.parent.id, partial.family]);
  assert.ok(Number.isInteger(slot));

  stage = 'concurrent-last-slots';
  const contenders = [];
  for (let i = 0; i < 12; i++) {
    const family = randomUUID(), parent = randomUUID(), student = randomUUID();
    familyIds.push(family);
    userIds.push(parent, student);
    await pool.query('insert into auth.users(id,email,email_confirmed_at) values ($1,$2,now()),($3,$4,now())',
      [parent, email(`race-${i}-parent`), student, email(`race-${i}-student`)]);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent'),($3,$2,'student')", [parent, family, student]);
    contenders.push([parent, family]);
  }
  const outcomes = await Promise.allSettled([...contenders, [partial.parent.id, partial.family], [partial.parent.id, partial.family]]
    .map(params => scoped('family_provision_worker', claim, params)));
  const winners = outcomes.slice(0, 12).filter(item => item.status === 'fulfilled').map(item => item.value);
  assert.equal(winners.length, 9 - occupied);
  assert.equal(new Set(winners).size, winners.length);
  for (const outcome of outcomes.slice(0, 12).filter(item => item.status === 'rejected')) assert.equal(outcome.reason.message, 'FAMILY_CAPACITY_FULL');
  assert.deepEqual(outcomes.slice(12), [{ status: 'fulfilled', value: slot }, { status: 'fulfilled', value: slot }]);
  assert.equal((await pool.query('select count(*)::int as n from wallet_custody.family_capacity_slots')).rows[0].n, 10);

  stage = 'overflow-enrollment-and-provision-denial';
  const overflow = await linked('overflow');
  await assert.rejects(scoped('family_provision_worker', claim, [partial.parent.id, overflow.family]), { message: 'PROVISION_FORBIDDEN' });
  const keys = ['parent','student','agent'].map(role => {
    const signer = Keypair.random();
    return { role, address: signer.publicKey(), seed: signer.secret() };
  });
  await assert.rejects(scoped('family_provision_worker', 'select wallet_custody.begin_family_provision($1,$2,$3,$4,$5,$6)',
    [overflow.parent.id, overflow.family, randomUUID(), Keypair.random().publicKey(), {}, JSON.stringify(keys)]), { message: 'FAMILY_CAPACITY_FULL' });
  const noFootprint = await pool.query(`select not exists(select from wallet_custody.family_signing_keys where family_id=$1)
    and not exists(select from public.money_operations where family_id=$1) as clean`, [overflow.family]);
  assert.equal(noFootprint.rows[0].clean, true);

  stage = 'readiness-and-financial-gate';
  for (const { family, parent, student } of [partial, overflow]) {
    await assert.rejects(pool.query('update public.family_members set wallet_ready=true where family_id=$1', [family]), { message: 'WALLET_ACTIVATION_UNAVAILABLE' });
    for (const [role, member] of [['parent', parent], ['student', student]]) {
      assert.deepEqual(await http(member.token, '/api/me'), { status: 200, body: { userId: member.id, familyId: family, role, walletReady: false } });
      for (const path of ['/api/allowance-funding', '/api/../api/purchases?recent=true', '/api/weekly', '/api/demo/advance', '/api/velo-topups']) {
        const result = await http(member.token, path);
        assert.equal(result.status, 409);
        assert.equal(result.body.error.code, 'WALLET_SETUP_REQUIRED');
      }
      const privateResult = await http(member.token, '/api/../api/allowance-funding', {}, true);
      assert.equal(privateResult.status, 409);
      assert.equal(privateResult.body.error.code, 'WALLET_SETUP_REQUIRED');
    }
  }
  stage = 'legacy-me-compatibility';
  await pool.query('update wallet_custody.family_capacity_slots set legacy=true where family_id=$1', [partial.family]);
  await pool.query('update public.family_members set wallet_ready=true where user_id=$1', [partial.parent.id]);
  assert.deepEqual(await http(partial.parent.token, '/api/me'), { status: 200,
    body: { userId: partial.parent.id, familyId: partial.family, role: 'parent' } });
  passed = true;
} catch (error) {
  const line = /verify-family-capacity\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  console.error(`FAIL: family-capacity (${stage}; ${error.code ?? error.name}${line ? `; line ${line}` : ''})`);
} finally {
  if (server) await new Promise(resolve => server.close(resolve));
  if (pool) {
    try {
      if (temporaryRoleGrant) await pool.query('revoke family_provision_worker from postgres');
      await pool.query('delete from wallet_custody.family_capacity_slots where family_id=any($1::uuid[])', [familyIds]);
      await pool.query('delete from public.student_setup_codes where family_id=any($1::uuid[])', [familyIds]);
      await pool.query('delete from public.family_members where user_id=any($1::uuid[])', [userIds]);
      await pool.query('delete from auth.users where id=any($1::uuid[])', [userIds]);
    } catch {
      if (userIds.length) { passed = false; console.error('FAIL: family-capacity (fixture cleanup)'); }
    } finally { await pool.end(); }
  }
}
if (passed) console.log('PASS: family-capacity (concurrent local Postgres and loopback HTTP/Auth; no ledger sends)');
else process.exitCode = 1;
