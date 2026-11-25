import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chmod, readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { Account, BASE_FEE, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { Velo } from '@carts1024/velo-sdk';
import { veloTopups } from '../src/velo-topups.mjs';
import { HORIZON_TESTNET, xlmToStroops } from '../src/velo-receipts.mjs';
import { assertLoopbackBindings, localConfiguration } from './local-verification.mjs';

// DEC-134/DEC-136 live proof, steps P0/P1. Creates one real Velo Testnet
// checkout per call and (for C) one disposable Testnet source, but never pays a
// checkout or credits a family. Checkouts are sequential by design: C is created
// and verified before D exists, so each intent window holds one candidate payment.
const STATE = new URL('../../../.env.t14-t17-live.json', import.meta.url);
const HORIZON = HORIZON_TESTNET;
const FRIENDBOT = 'https://friendbot.stellar.org';
const AMOUNT_STROOPS = 10330579n;
const modes = ['preflight', 'prepare', 'prepare-late'];
const mode = process.argv[2];
let stage = 'arguments', passed = false, pool, service, operator, receiver, velo, summary = {};
const members = [];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function horizon(path, init) {
  return fetch(`${HORIZON}${path}`, { redirect: 'error', signal: AbortSignal.timeout(15000), ...init });
}
async function account(address) {
  const response = await horizon(`/accounts/${encodeURIComponent(address)}`);
  if (response.status === 404) return null;
  assert.equal(response.ok, true, `horizon account read ${address}`);
  return response.json();
}
const nativeStroops = body => xlmToStroops(body.balances.find(balance => balance.asset_type === 'native').balance);
async function fund(address) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const response = await fetch(`${FRIENDBOT}/?addr=${encodeURIComponent(address)}`, {
      redirect: 'error', signal: AbortSignal.timeout(20000),
    });
    if (response.ok) return;
    const text = await response.text();
    if (/already funded|createAccountAlreadyExist|op_already_exists/i.test(text)) return;
    if (response.status !== 429) throw Error(`friendbot ${response.status}`);
    await sleep(2000 * (attempt + 1));
  }
  throw Error('friendbot unavailable');
}
async function configureSource(source, guard) {
  const current = await account(source.publicKey());
  assert.ok(current, 'disposable T15 source is not funded');
  const transaction = new TransactionBuilder(new Account(source.publicKey(), current.sequence), {
    fee: BASE_FEE, networkPassphrase: Networks.TESTNET,
    timebounds: { minTime: 0, maxTime: Math.floor(Date.now() / 1000) + 120 },
  }).addOperation(Operation.setOptions({
    masterWeight: 1, lowThreshold: 2, medThreshold: 2, highThreshold: 2,
    signer: { ed25519PublicKey: guard.publicKey(), weight: 1 },
  })).build();
  transaction.sign(source);
  const response = await fetch(`${HORIZON}/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `tx=${encodeURIComponent(transaction.toXDR())}`, redirect: 'error', signal: AbortSignal.timeout(20000),
  });
  const text = await response.text();
  if (!response.ok) throw Error(`t15 source setup failed ${response.status} ${text.slice(0, 240)}`);
  for (let attempt = 0; attempt < 10; attempt++) {
    const configured = await account(source.publicKey());
    const keys = (configured?.signers ?? []).map(signer => signer.key).sort();
    if (keys.length === 2 && keys.includes(source.publicKey()) && keys.includes(guard.publicKey())
      && ['low_threshold', 'med_threshold', 'high_threshold'].every(name => configured.thresholds[name] === 2)) return;
    await sleep(1000);
  }
  throw Error('t15 source authority did not settle');
}

async function parent() {
  const email = `live-${randomUUID()}@example.test`;
  const created = await service.auth.admin.createUser({
    email, password: local.password(email), email_confirm: true,
  });
  assert.equal(created.error, null);
  const member = { family_id: randomUUID(), user_id: created.data.user.id, role: 'parent' };
  members.push(member);
  await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent')", [member.user_id, member.family_id]);
  return member;
}
function handler() {
  const calls = { create: 0 };
  const provider = {
    paymentIntents: velo.paymentIntents,
    checkout: { sessions: { create: async (input, options) => {
      calls.create++;
      return velo.checkout.sessions.create(input, options);
    } } },
  };
  const request = async (member, method, body, key = randomUUID()) => {
    const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
    await veloTopups({ method, headers: method === 'POST' ? { 'idempotency-key': key } : {}, body }, res, {
      authenticate: async () => ({ member }), database: () => service, receiver: () => receiver,
      provider: () => provider, operator: () => operator, horizon: fetch,
    });
    return res;
  };
  return { request, calls };
}
async function readState() {
  try { return JSON.parse(await readFile(STATE, 'utf8')); } catch { return null; }
}
async function writeState(state) {
  await writeFile(STATE, JSON.stringify(state, null, 2), { mode: 0o600 });
  await chmod(STATE, 0o600);
}
// DEC-139: an explicit deposit does not expose its checkout URL to the parent.
// The operator reads the stored URL from the isolated database instead.
async function storedCheckout(id) {
  return (await pool.query('select checkout_url from public.velo_topups where id=$1', [id])).rows[0]?.checkout_url;
}
function depositState(member, body, intent, checkoutUrl) {
  return {
    familyId: member.family_id, parentId: member.user_id, depositId: body.id,
    intentId: body.intentId, checkoutUrl,
    expiresAt: intent.expiresAt, status: intent.status,
  };
}

let local;
try {
  assert.ok(modes.includes(mode), `usage: live-deposit-checkout.mjs ${modes.join('|')}`);
  stage = 'local-database';
  assertLoopbackBindings();
  local = await localConfiguration();
  service = local.admin;
  pool = new pg.Pool({ connectionString: local.status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });

  stage = 'configuration';
  assert.ok(process.env.VELO_API_KEY, 'VELO_API_KEY is required');
  receiver = Keypair.fromSecret(process.env.OWNER_SECRET).publicKey();
  const ownerEnv = process.env.OWNER_PUBLIC_KEY ? Keypair.fromPublicKey(process.env.OWNER_PUBLIC_KEY).publicKey() : null;
  if (ownerEnv) assert.equal(ownerEnv, receiver, 'OWNER_PUBLIC_KEY and OWNER_SECRET disagree');
  assert.ok(process.env.OPERATOR_PAYER_PUBLIC_KEY, 'OPERATOR_PAYER_PUBLIC_KEY is required so the receipt payer is pinned before payment');
  operator = Keypair.fromPublicKey(process.env.OPERATOR_PAYER_PUBLIC_KEY).publicKey();
  assert.notEqual(operator, receiver, 'operator payer must differ from the project receiver');
  const guard = process.env.MONEY_COORDINATOR_GUARD_PUBLIC_KEY
    ? Keypair.fromPublicKey(process.env.MONEY_COORDINATOR_GUARD_PUBLIC_KEY).publicKey() : null;
  velo = new Velo({ apiKey: process.env.VELO_API_KEY, baseUrl: 'https://www.velo-build.dev', environment: 'testnet', timeoutMs: 15000, maxRetries: 0 });

  stage = 'throwaway checkout';
  const throwaway = await parent();
  const probe = handler();
  const created = await probe.request(throwaway, 'POST', { expectedRevision: 0, amountMinor: '1000' });
  assert.equal(created.statusCode, 201, `checkout create returned ${created.statusCode} ${JSON.stringify(created.body)}`);
  assert.equal(created.body.expectedReceiver, receiver, 'Velo receiver is not the pinned project owner');
  assert.equal(created.body.checkoutUrl, null, 'an explicit deposit must not expose a payable link to the parent');
  assert.match(await storedCheckout(created.body.id) ?? '', /^https:\/\/www\.velo-build\.dev\//);
  assert.equal(created.body.amountXlm, '1.0330579');
  const intent = await velo.paymentIntents.retrieve(created.body.intentId);
  assert.equal(intent.receiverAddress, receiver);
  assert.equal(intent.amount, '1.0330579');
  assert.ok(['created', 'pending'].includes(intent.status));
  assert.ok(Number.isFinite(Date.parse(intent.expiresAt)), 'intent has no expiry');
  assert.ok(Math.min(Date.parse(intent.expiresAt) - Date.now(), 30 * 60 * 1000) > 60 * 1000, 'checkout window is too short');
  summary.checkout = { intentId: created.body.intentId, receiver, status: intent.status, expiresAt: intent.expiresAt };
  await pool.query('delete from public.velo_topups where parent_id=$1', [throwaway.user_id]);
  await pool.query('delete from public.family_members where user_id=$1', [throwaway.user_id]);
  members.splice(members.findIndex(member => member.user_id === throwaway.user_id), 1);
  assert.equal((await service.auth.admin.deleteUser(throwaway.user_id)).error, null);

  stage = 'operator payer';
  let funded = await account(operator);
  if (!funded) { await fund(operator); funded = await account(operator); }
  assert.ok(nativeStroops(funded) >= AMOUNT_STROOPS, 'operator payer cannot cover the approved checkout amount');
  summary.operator = { configured: true, funded: true, balanceStroops: nativeStroops(funded).toString() };
  summary.t15 = { preference: 'fresh-source-and-guard (no local guard credentials)' };

  if (mode === 'preflight') {
    summary.mode = 'preflight';
    summary.environment = {
      veloKey: 'present', ownerReceiver: 'derived-from-OWNER_SECRET', operatorPayer: 'present',
      coordinatorGuard: process.env.MONEY_COORDINATOR_GUARD_SECRET ? 'present' : 'absent', database: 'local-isolated',
    };
    passed = true;
    console.log('PASS: live-deposit preflight (local database, real Velo checkout, no payment)');
    console.log(JSON.stringify(summary, null, 2));
  } else {
    const previous = await readState();

    stage = 't15 source';
    let t15 = previous?.t15;
    if (!t15) {
      const source = Keypair.random();
      const sourceGuard = Keypair.random();
      const destination = Keypair.random().publicKey();
      await fund(source.publicKey());
      await sleep(1200);
      await fund(destination);
      await configureSource(source, sourceGuard);
      t15 = {
        source: source.publicKey(), sourceSecret: source.secret(), guard: sourceGuard.publicKey(),
        guardSecret: sourceGuard.secret(), destination,
      };
    }

    if (mode === 'prepare') {
      assert.ok(!previous?.c, 'checkout C already prepared; verify it or remove the stale state file');
      stage = 'prepare checkout c';
      const member = await parent();
      const live = handler();
      const key = randomUUID();
      const made = await live.request(member, 'POST', { expectedRevision: 0, amountMinor: '1000' }, key);
      assert.equal(made.statusCode, 201, `deposit C ${made.statusCode} ${JSON.stringify(made.body)}`);
      assert.equal(made.body.checkoutUrl, null);
      const checkoutC = await storedCheckout(made.body.id);
      assert.match(checkoutC ?? '', /^https:\/\/www\.velo-build\.dev\//);
      assert.equal(made.body.amountXlm, '1.0330579');
      const callsAfter = live.calls.create;

      stage = 't13 admission';
      const second = await live.request(member, 'POST', { expectedRevision: 0, amountMinor: '1000' });
      assert.equal(second.statusCode, 409);
      assert.equal(second.body.error.code, 'TOPUP_PENDING');
      assert.equal(live.calls.create, callsAfter, 'a blocked deposit must not reach the provider');
      const replay = await live.request(member, 'POST', { expectedRevision: 0, amountMinor: '1000' }, key);
      assert.equal(replay.statusCode, 200);
      assert.equal(replay.body.id, made.body.id);
      assert.equal(replay.body.intentId, made.body.intentId);

      const intentC = await velo.paymentIntents.retrieve(made.body.intentId);
      const state = {
        ...previous, version: 2, preparedAt: new Date().toISOString(), network: 'testnet', decision: 'DEC-136',
        owner: { receiver }, operator,
        amount: { minor: '1000', xlm: made.body.amountXlm, stroops: xlmToStroops(made.body.amountXlm).toString() },
        c: depositState(member, made.body, intentC, checkoutC), t15,
      };
      await writeState(state);
      summary.mode = 'prepare';
      summary.c = { checkoutUrl: state.c.checkoutUrl, amountXlm: state.amount.xlm, expiresAt: state.c.expiresAt };
      summary.source = { account: t15.source, destination: t15.destination, guard: t15.guard };
      passed = true;
      console.log('PASS: live-deposit prepare (one real checkout, T13 admission checks, T15 source ready)');
      console.log(JSON.stringify(summary, null, 2));
    } else {
      stage = 'prepare-late ordering';
      assert.ok(previous?.c, 'checkout C must be prepared and verified before D');
      assert.ok(previous.c.familyId && previous.c.depositId, 'state file has no checkout C');
      const verified = (await pool.query(
        "select verification_status,tx_hash from public.velo_topups where id=$1",
        [previous.c.depositId],
      )).rows[0];
      assert.equal(verified?.verification_status, 'verified', 'checkout D must wait for a verified C receipt');
      assert.match(verified.tx_hash ?? '', /^[a-f0-9]{64}$/);
      const credited = (await pool.query(
        `select count(*)::int as n from public.money_operations o
         join public.money_dispatch_steps d on d.operation_id=o.id and d.step_key='credit'
         where o.family_id=$1 and o.request_key=$2 and o.purpose='deposit_credit' and d.phase='confirmed'`,
        [previous.c.familyId, previous.c.depositId],
      )).rows[0].n;
      assert.equal(credited, 1, 'checkout D must wait for a confirmed C credit');

      stage = 'prepare checkout d';
      const member = await parent();
      const live = handler();
      const made = await live.request(member, 'POST', { expectedRevision: 0, amountMinor: '1000' });
      assert.equal(made.statusCode, 201, `deposit D ${made.statusCode} ${JSON.stringify(made.body)}`);
      assert.equal(made.body.checkoutUrl, null);
      const checkoutD = await storedCheckout(made.body.id);
      assert.match(checkoutD ?? '', /^https:\/\/www\.velo-build\.dev\//);
      const cancelled = await live.request(member, 'POST', { cancelId: made.body.id });
      assert.equal(cancelled.statusCode, 200, `cancel ${cancelled.statusCode} ${JSON.stringify(cancelled.body)}`);
      assert.equal(cancelled.body.status, 'cancelled');
      assert.equal(cancelled.body.cancellationState, 'fenced');
      assert.equal(cancelled.body.checkoutUrl, null);
      const stored = (await pool.query(
        'select status,intent_id,checkout_url,cancelled_at,cancellation_state from public.velo_topups where id=$1',
        [made.body.id],
      )).rows[0];
      assert.equal(stored.status, 'created');
      assert.equal(stored.intent_id, made.body.intentId);
      assert.equal(stored.checkout_url, null);
      assert.ok(stored.cancelled_at);
      assert.equal(stored.cancellation_state, 'fenced');

      const intentD = await velo.paymentIntents.retrieve(made.body.intentId);
      const state = { ...previous, d: depositState(member, made.body, intentD, checkoutD) };
      await writeState(state);
      summary.mode = 'prepare-late';
      summary.d = { checkoutUrl: state.d.checkoutUrl, amountXlm: previous.amount.xlm, expiresAt: state.d.expiresAt, cancelledInApp: true };
      passed = true;
      console.log('PASS: live-deposit prepare-late (one real checkout, cancelled in-app, C already verified and credited)');
      console.log(JSON.stringify(summary, null, 2));
    }
  }
} catch (error) {
  console.error(`FAIL: live-deposit ${mode ?? '(no mode)'} (${stage}; ${error.code ?? error.message})`);
}
finally {
  try {
    const ids = members.map(member => member.user_id);
    if (mode === 'preflight' && ids.length) {
      await pool?.query('delete from public.velo_topups where parent_id=any($1::uuid[])', [ids]);
      await pool?.query('delete from public.family_members where user_id=any($1::uuid[])', [ids]);
      for (const id of ids) await service.auth.admin.deleteUser(id);
    }
  } finally { await pool?.end(); }
}
if (!passed) process.exitCode ||= 1;
