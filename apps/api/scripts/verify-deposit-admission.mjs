import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { Keypair } from '@stellar/stellar-sdk';
import { veloTopups } from '../src/velo-topups.mjs';
import { assertLoopbackBindings, localConfiguration } from './local-verification.mjs';

let pool, admin, stage = 'loopback';
const members = [];
try {
  assertLoopbackBindings();
  const { status, admin: client, password } = await localConfiguration();
  admin = client;
  const url = new URL(status.DB_URL);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.host, '127.0.0.1:54332');
  assert.equal(url.pathname, '/postgres');
  pool = new pg.Pool({ connectionString: status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });
  async function parent() {
    const email = `deposit-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password: password(email), email_confirm: true });
    assert.equal(created.error, null);
    const member = { family_id: randomUUID(), user_id: created.data.user.id, role: 'parent' };
    members.push(member);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent')", [member.user_id, member.family_id]);
    return member;
  }
  const [a, b, c] = await Promise.all([parent(), parent(), parent()]);
  const receiver = Keypair.random().publicKey();
  let checkoutCalls = 0;
  const intents = new Map();
  async function call(member, amount, key = randomUUID(), revision = 0) {
    const body = { expectedRevision: revision, ...(amount === undefined ? {} : { amountMinor: amount }) };
    const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
    await veloTopups({ method: 'POST', headers: { 'idempotency-key': key }, body }, res, {
      authenticate: async () => ({ member }), database: () => admin, receiver: () => receiver,
      provider: () => ({
        checkout: { sessions: { create: async ({ amount: xlm }) => {
          checkoutCalls++;
          const paymentIntentId = randomUUID().replaceAll('-', '');
          const intent = {
            paymentIntentId, asset: 'native', status: 'created', amount: xlm, receiverAddress: receiver,
            createdAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          };
          intents.set(paymentIntentId, intent);
          return intent;
        } } },
        paymentIntents: { retrieve: async id => {
          const intent = intents.get(id);
          if (!intent) throw Error('missing intent');
          return { ...intent };
        } },
      }),
    });
    return res;
  }
  async function rejected(promise, status, code) {
    const res = await promise;
    assert.equal(res.statusCode, status);
    assert.equal(res.body.error.code, code);
    assert.deepEqual(Object.keys(res.body.error).sort(), ['code', 'message', 'retryable']);
  }
  const setStatus = (id, status) => pool.query('update public.velo_topups set status=$2 where id=$1', [id, status]);
  stage = 'validation';
  for (const bad of [1000, '10.001', '01000', '-1000', null]) await rejected(call(a, bad), 400, 'INVALID_INPUT');
  await rejected(call(a, '999'), 400, 'DEPOSIT_MINIMUM');
  await rejected(call(a, '500001'), 409, 'DEPOSIT_CAP_EXCEEDED');
  await rejected(call(a, '1000', randomUUID(), 1), 409, 'RULES_CHANGED');
  stage = 'exact cap and canonical replay';
  const key = randomUUID();
  const replay = await Promise.all([call(a, '500000', key), call(a, '500000', key)]);
  assert.deepEqual(replay.map(r => r.statusCode).sort(), [200, 201]);
  assert.deepEqual(replay[0].body, replay[1].body);
  const full = replay[0].body;
  assert.equal(full.amountXlm, '516.5289256');
  assert.equal(full.amountMinor, '500000');
  assert.equal(full.mappingVersion, 'php-xlm-20261107-v1');
  assert.equal(full.status, 'created');
  assert.equal(full.checkoutUrl, null);
  await rejected(call(a, '499999', key), 409, 'IDEMPOTENCY_CONFLICT');
  await rejected(call(a, '500000', key, 1), 409, 'IDEMPOTENCY_CONFLICT');
  await rejected(call(a, undefined, key), 409, 'IDEMPOTENCY_CONFLICT');
  await rejected(call(a, '1000'), 409, 'TOPUP_PENDING');
  await rejected(call(a, undefined), 409, 'TOPUP_PENDING');
  await setStatus(full.id, 'paid'); // Fixture for the already-settled lifetime-cap case; no actual credit.
  await rejected(call(a, '1000'), 409, 'DEPOSIT_CAP_EXCEEDED');
  stage = 'cumulative cap and concurrent reservations';
  const first = await call(b, '498999', key);
  assert.equal(first.statusCode, 201);
  assert.notEqual(first.body.id, full.id);
  await setStatus(first.body.id, 'paid');
  await rejected(call(b, '1002'), 409, 'DEPOSIT_CAP_EXCEEDED');
  const race = await Promise.all([call(b, '1001'), call(b, '1001')]);
  assert.deepEqual(race.map(r => r.statusCode).sort(), [201, 409]);
  assert.equal(race.find(r => r.statusCode === 409).body.error.code, 'TOPUP_PENDING');
  const reserved = race.find(r => r.statusCode === 201).body;
  assert.equal(reserved.amountXlm, '1.0340909');
  await setStatus(reserved.id, 'unknown');
  await rejected(call(b, '1001'), 409, 'TOPUP_PENDING');
  await setStatus(reserved.id, 'cancelled');
  assert.equal((await call(b, '1001')).statusCode, 201);
  assert.ok(checkoutCalls > 0);
  stage = 'legacy checkout compatibility';
  const callsBeforeLegacy = checkoutCalls;
  const legacyKey = randomUUID();
  const legacy = await call(c, undefined, legacyKey);
  assert.equal(legacy.statusCode, 201);
  assert.equal(legacy.body.amountXlm, '1.0000000');
  assert.equal(Object.hasOwn(legacy.body, 'amountMinor'), false);
  await rejected(call(c, '1000', legacyKey), 409, 'IDEMPOTENCY_CONFLICT');
  await rejected(call(c, '1000'), 409, 'TOPUP_PENDING');
  assert.equal(checkoutCalls, callsBeforeLegacy + 1);
  console.log('PASS: deposit-admission (loopback Postgres and API handler; simulated provider only)');
} catch (error) {
  const line = /verify-deposit-admission\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  console.error(`FAIL: deposit-admission (${stage}; ${error.code ?? error.name}${line ? `; line ${line}` : ''})`);
  process.exitCode = 1;
} finally {
  try {
    const ids = members.map(m => m.user_id);
    if (ids.length) {
      await pool.query('delete from public.velo_topups where parent_id=any($1::uuid[])', [ids]);
      await pool.query('delete from public.family_members where user_id=any($1::uuid[])', [ids]);
      for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  } finally { await pool?.end(); }
}
