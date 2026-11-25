import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';
import { Keypair } from '@stellar/stellar-sdk';
import { veloTopups } from '../src/velo-topups.mjs';
import { assertLoopbackBindings, localConfiguration } from './local-verification.mjs';

let pool, admin, stage = 'loopback';
let passed = false;
const members = [], familyIds = [];
try {
  assertLoopbackBindings();
  const { status, admin: client, password } = await localConfiguration();
  admin = client;
  const url = new URL(status.DB_URL);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.host, '127.0.0.1:54332');
  assert.equal(url.pathname, '/postgres');
  pool = new pg.Pool({ connectionString: status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });

  const columns = await pool.query("select column_name from information_schema.columns where table_schema='public' and table_name='velo_topups'");
  for (const name of ['payer_address', 'tx_hash', 'verification_status', 'verified_at', 'verified_ledger']) {
    assert.ok(columns.rows.some(row => row.column_name === name), `missing T14 column ${name}`);
  }

  async function parent() {
    const email = `receipt-${randomUUID()}@example.test`;
    const created = await admin.auth.admin.createUser({ email, password: password(email), email_confirm: true });
    assert.equal(created.error, null);
    const member = { family_id: randomUUID(), user_id: created.data.user.id, role: 'parent' };
    members.push(member);
    familyIds.push(member.family_id);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent')", [member.user_id, member.family_id]);
    return member;
  }

  const [a, b, c, d, e, f, g, h, i, j, k] = await Promise.all(Array.from({ length: 11 }, () => parent()));
  const receiver = Keypair.random().publicKey();
  const operator = Keypair.random().publicKey();
  const otherPayer = Keypair.random().publicKey();
  const hash1 = 'a'.repeat(64);
  const intents = new Map();
  let createCalls = 0, failCreate = false, windowOverride = null;
  const provider = {
    checkout: { sessions: { create: async ({ amount }) => {
      if (failCreate) throw Error('provider down');
      createCalls++;
      const id = randomUUID().replaceAll('-', '');
      const intent = {
        paymentIntentId: id, status: 'created', amount, asset: 'native',
        receiverAddress: receiver, payerAddress: null,
        checkoutUrl: `https://www.velo-build.dev/pay/${id}`,
        createdAt: windowOverride?.createdAt ?? new Date().toISOString(),
        expiresAt: windowOverride?.expiresAt ?? new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      };
      intents.set(id, intent);
      return intent;
    } } },
    paymentIntents: { retrieve: async id => {
      const intent = intents.get(id);
      if (!intent) throw Error('missing intent');
      return structuredClone(intent);
    } },
  };
  let payments = [], transactionRecord = null, horizonCalls = 0;
  const horizon = async url => {
    horizonCalls++;
    if (url.includes('/transactions/')) return { ok: true, json: async () => structuredClone(transactionRecord) };
    return { ok: true, json: async () => ({ _embedded: { records: structuredClone(payments) } }) };
  };
  const payment = (amount, hash, createdAt, payer = operator) => ({
    type: 'payment', asset_type: 'native', from: payer, to: receiver,
    transaction_successful: true, transaction_hash: hash, amount, created_at: createdAt,
  });
  const transaction = (hash, ledger) => ({ hash, successful: true, ledger });

  async function request(member, method, body, key = randomUUID()) {
    const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
    await veloTopups({ method, headers: method === 'POST' ? { 'idempotency-key': key } : {}, body }, res, {
      authenticate: async () => ({ member }), database: () => admin, receiver: () => receiver,
      provider: () => provider, operator: () => operator, horizon,
    });
    return res;
  }
  const get = member => request(member, 'GET');
  const create = (member, amount, key = randomUUID()) => request(member, 'POST', { expectedRevision: 0, ...(amount === undefined ? {} : { amountMinor: amount }) }, key);

  stage = 'explicit checkout attachment';
  const keyA = randomUUID();
  const createdA = await create(a, '1000', keyA);
  assert.equal(createdA.statusCode, 201);
  assert.equal(createdA.body.status, 'created');
  // DEC-139: the parent is not shown a payment only the pinned operator can make.
  assert.equal(createdA.body.checkoutUrl, null);
  assert.match((await pool.query('select checkout_url from public.velo_topups where id=$1', [createdA.body.id])).rows[0].checkout_url,
    /^https:\/\/www\.velo-build\.dev\/pay\//, 'the operator-side URL must still be stored');
  assert.ok(createdA.body.intentId);
  assert.equal(createdA.body.verificationStatus, 'unverified');
  assert.equal(createCalls, 1);
  const replayA = await create(a, '1000', keyA);
  assert.equal(replayA.statusCode, 200);
  assert.equal(replayA.body.id, createdA.body.id);
  assert.equal(replayA.body.intentId, createdA.body.intentId);
  assert.equal(replayA.body.checkoutUrl, null);
  assert.equal(createCalls, 1);

  stage = 'verified receipt';
  const intentA = intents.get(createdA.body.intentId);
  Object.assign(intentA, { status: 'paid', payerAddress: operator });
  payments = [payment(createdA.body.amountXlm, hash1, intentA.createdAt)];
  transactionRecord = transaction(hash1, 5726509);
  const paidA = await get(a);
  const rowA = paidA.body.topups.find(row => row.id === createdA.body.id);
  assert.equal(rowA.status, 'paid');
  assert.equal(rowA.verificationStatus, 'verified');
  assert.equal(rowA.txHash, hash1);
  assert.equal(rowA.verifiedLedger, '5726509');
  const storedA = (await pool.query('select payer_address,tx_hash,verification_status,verified_ledger from public.velo_topups where id=$1', [createdA.body.id])).rows[0];
  assert.equal(storedA.payer_address, operator);
  assert.equal(storedA.tx_hash, hash1);
  assert.equal(storedA.verification_status, 'verified');
  assert.equal(storedA.verified_ledger, '5726509');
  const horizonAfterVerified = horizonCalls;
  const repeatedA = await get(a);
  assert.equal(repeatedA.body.topups.find(row => row.id === createdA.body.id).txHash, hash1);
  assert.equal(horizonCalls, horizonAfterVerified, 'verified receipts must not be re-read from Horizon');

  stage = 'a later same-amount payment verifies once the earlier hash is bound';
  const createdG = await create(g, '1000');
  const intentG = intents.get(createdG.body.intentId);
  Object.assign(intentG, { status: 'paid', payerAddress: operator });
  const laterHash = 'b'.repeat(64);
  payments = [
    payment(createdG.body.amountXlm, hash1, intentG.createdAt),
    payment(createdG.body.amountXlm, laterHash, intentG.createdAt),
  ];
  transactionRecord = transaction(laterHash, 5726511);
  const paidG = await get(g);
  const rowG = paidG.body.topups.find(row => row.id === createdG.body.id);
  assert.equal(rowG.status, 'paid');
  assert.equal(rowG.verificationStatus, 'verified');
  assert.equal(rowG.txHash, laterHash);
  assert.equal(rowG.verifiedLedger, '5726511');
  assert.equal((await pool.query('select tx_hash from public.velo_topups where id=$1', [createdG.body.id])).rows[0].tx_hash, laterHash);

  stage = 'reused hash is refused';
  const createdB = await create(b, '1000');
  const intentB = intents.get(createdB.body.intentId);
  Object.assign(intentB, { status: 'paid', payerAddress: operator });
  payments = [payment(createdB.body.amountXlm, hash1, intentB.createdAt)];
  transactionRecord = transaction(hash1, 5726510);
  const paidB = await get(b);
  const rowB = paidB.body.topups.find(row => row.id === createdB.body.id);
  assert.equal(rowB.status, 'paid');
  // The only candidate payment is already bound to deposit A, so no unused hash remains.
  assert.equal(rowB.verificationStatus, 'unavailable');
  assert.equal(rowB.txHash, undefined);
  assert.equal((await pool.query('select tx_hash,verification_status from public.velo_topups where id=$1', [createdB.body.id])).rows[0].tx_hash, null);

  stage = 'missing payment stays unavailable';
  const createdC = await create(c, '1000');
  const intentC = intents.get(createdC.body.intentId);
  Object.assign(intentC, { status: 'paid', payerAddress: operator });
  payments = [];
  transactionRecord = null;
  const paidC = await get(c);
  const rowC = paidC.body.topups.find(row => row.id === createdC.body.id);
  assert.equal(rowC.status, 'paid');
  assert.equal(rowC.verificationStatus, 'unavailable');
  assert.equal(rowC.txHash, undefined);
  const horizonBeforeRetry = horizonCalls;
  await get(c);
  assert.equal(horizonCalls, horizonBeforeRetry, 'a settled unavailable receipt is not re-read within the retry interval');

  stage = 'wrong payer stays unverified';
  const createdD = await create(d, '1000');
  const intentD = intents.get(createdD.body.intentId);
  Object.assign(intentD, { status: 'paid', payerAddress: otherPayer });
  const beforeWrongPayer = horizonCalls;
  const paidD = await get(d);
  const rowD = paidD.body.topups.find(row => row.id === createdD.body.id);
  assert.equal(rowD.status, 'paid');
  assert.equal(rowD.verificationStatus, 'mismatch');
  assert.equal(rowD.txHash, undefined);
  assert.equal(horizonCalls, beforeWrongPayer, 'a non-pinned payer must not reach Horizon');

  stage = 'provider failure does not recreate checkout';
  failCreate = true;
  const keyE = randomUUID();
  const failedE = await create(e, '1000', keyE);
  assert.equal(failedE.statusCode, 201);
  assert.equal(failedE.body.status, 'unknown');
  assert.equal(failedE.body.checkoutUrl, null);
  const callsAfterFailure = createCalls;
  const replayE = await create(e, '1000', keyE);
  assert.equal(replayE.statusCode, 200);
  assert.equal(replayE.body.status, 'unknown');
  assert.equal(createCalls, callsAfterFailure);
  failCreate = false;

  stage = 'legacy checkout remains compatible';
  const legacy = await create(f, undefined);
  assert.equal(legacy.statusCode, 201);
  assert.equal(legacy.body.status, 'created');
  assert.match(legacy.body.checkoutUrl, /^https:\/\/www\.velo-build\.dev\/pay\//);
  assert.equal(Object.hasOwn(legacy.body, 'amountMinor'), false);
  assert.equal(Object.hasOwn(legacy.body, 'verificationStatus'), false);
  assert.equal((await get(f)).body.topups[0].status, 'created');

  stage = 'overlapping explicit intent windows claim neither payment';
  async function paired(member, window) {
    windowOverride = window;
    const created = await create(member, '1000');
    windowOverride = null;
    assert.equal(created.statusCode, 201, `paired checkout ${created.statusCode}`);
    const intent = intents.get(created.body.intentId);
    Object.assign(intent, { status: 'paid', payerAddress: operator });
    return { created, intent };
  }
  async function assertNeitherClaims(deposits, hash, paidAt) {
    payments = [payment(deposits[0].created.body.amountXlm, hash, paidAt)];
    transactionRecord = transaction(hash, 5726512);
    for (const deposit of deposits) {
      const response = await get(deposit.member);
      const row = response.body.topups.find(item => item.id === deposit.created.body.id);
      assert.equal(row.status, 'paid');
      assert.equal(row.verificationStatus, 'unavailable', `deposit ${deposit.created.body.id} must not claim another window's payment`);
      assert.equal(row.txHash, undefined);
      assert.equal((await pool.query('select tx_hash from public.velo_topups where id=$1', [deposit.created.body.id])).rows[0].tx_hash, null);
    }
  }
  const t1 = Date.now() - 6 * 60 * 60 * 1000;
  const h1 = await paired(h, { createdAt: new Date(t1 - 10 * 60 * 1000).toISOString(), expiresAt: new Date(t1 + 10 * 60 * 1000).toISOString() });
  const i1 = await paired(i, { createdAt: new Date(t1 - 5 * 60 * 1000).toISOString(), expiresAt: new Date(t1 + 15 * 60 * 1000).toISOString() });
  await assertNeitherClaims([{ ...h1, member: h }, { ...i1, member: i }], 'c'.repeat(64), new Date(t1).toISOString());
  const t2 = t1 - 6 * 60 * 60 * 1000;
  const j1 = await paired(j, { createdAt: new Date(t2 - 8 * 60 * 1000).toISOString(), expiresAt: new Date(t2 + 8 * 60 * 1000).toISOString() });
  const k1 = await paired(k, { createdAt: new Date(t2 - 4 * 60 * 1000).toISOString(), expiresAt: new Date(t2 + 12 * 60 * 1000).toISOString() });
  // Reverse verification order: the outcome cannot depend on who asks first.
  await assertNeitherClaims([{ ...k1, member: k }, { ...j1, member: j }], 'd'.repeat(64), new Date(t2).toISOString());

  stage = 'browser cannot submit a receipt';
  const injected = await request(a, 'POST', { expectedRevision: 0, amountMinor: '1000', txHash: hash1 });
  assert.equal(injected.statusCode, 400);
  assert.equal(injected.body.error.code, 'INVALID_INPUT');

  stage = 'no family credit';
  const credits = await pool.query('select count(*)::int as n from public.money_operations where family_id=any($1::uuid[])', [familyIds]);
  assert.equal(credits.rows[0].n, 0);

  passed = true;
  console.log('PASS: deposit-receipt (loopback Postgres and API handler; simulated Velo and Horizon)');
} catch (error) {
  const line = /verify-deposit-receipt\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  console.error(`FAIL: deposit-receipt (${stage}; ${error.code ?? error.name}${line ? `; line ${line}` : ''})`);
} finally {
  try {
    const ids = members.map(member => member.user_id);
    if (ids.length) {
      await pool.query('delete from public.velo_topups where parent_id=any($1::uuid[])', [ids]);
      await pool.query('delete from public.family_members where user_id=any($1::uuid[])', [ids]);
      for (const id of ids) assert.equal((await admin.auth.admin.deleteUser(id)).error, null);
    }
  } catch {
    passed = false;
    if (members.length) console.error('FAIL: deposit-receipt (fixture cleanup)');
  } finally { await pool?.end(); }
}
if (!passed) process.exitCode = 1;
