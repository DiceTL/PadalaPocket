import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { Keypair } from '@stellar/stellar-sdk';
import { veloTopups } from '../src/velo-topups.mjs';
import { creditVeloDeposit } from '../src/velo-deposit-credit.mjs';
import { assertLoopbackBindings, coordinatorConfiguration } from './local-verification.mjs';

// T16 cancels only the app-level checkout. Velo and Horizon are simulated;
// no live payment, transfer or cancellation is claimed.
let pool, coordinator, service, stage = 'loopback';
let passed = false;
const members = [];
try {
  assertLoopbackBindings();
  const { status, admin: coordinatorClient, legacy: serviceClient, password } = await coordinatorConfiguration();
  coordinator = coordinatorClient;
  service = serviceClient;
  const url = new URL(status.DB_URL);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.host, '127.0.0.1:54332');
  pool = new pg.Pool({ connectionString: status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });

  async function parent() {
    const email = `cancel-${randomUUID()}@example.test`;
    const created = await service.auth.admin.createUser({ email, password: password(email), email_confirm: true });
    assert.equal(created.error, null);
    const member = { family_id: randomUUID(), user_id: created.data.user.id, role: 'parent' };
    members.push(member);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent')", [member.user_id, member.family_id]);
    return member;
  }

  const [a, b, c, d, e, f, g, h, i] = await Promise.all(Array.from({ length: 9 }, () => parent()));
  const receiver = Keypair.random().publicKey();
  const operator = Keypair.random().publicKey();
  const source = Keypair.random().publicKey();
  const parentWallet = Keypair.random().publicKey();
  const intents = new Map();
  let createCalls = 0, failCreate = false, payments = [], transactionRecord = null;
  const provider = {
    checkout: { sessions: { create: async ({ amount }) => {
      if (failCreate) throw Error('provider down');
      createCalls++;
      const id = randomUUID().replaceAll('-', '');
      const intent = {
        paymentIntentId: id, status: 'created', amount, asset: 'native',
        receiverAddress: receiver, payerAddress: null,
        checkoutUrl: `https://www.velo-build.dev/pay/${id}`,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
  const horizon = async url => {
    if (url.includes('/transactions/')) return { ok: true, json: async () => structuredClone(transactionRecord) };
    return { ok: true, json: async () => ({ _embedded: { records: structuredClone(payments) } }) };
  };
  const payment = (amount, hash, createdAt) => ({
    type: 'payment', asset_type: 'native', from: operator, to: receiver,
    transaction_successful: true, transaction_hash: hash, amount, created_at: createdAt,
  });
  const transaction = (hash, ledger) => ({ hash, successful: true, ledger });

  async function request(member, method, body, key = randomUUID()) {
    const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
    await veloTopups({ method, headers: method === 'POST' ? { 'idempotency-key': key } : {}, body }, res, {
      authenticate: async () => ({ member }), database: () => service, provider: () => provider,
      receiver: () => receiver, operator: () => operator, horizon,
    });
    return res;
  }
  const get = member => request(member, 'GET');
  // Distinct centavo amounts keep each stage's payment unambiguous: the stronger
  // T14 claimability rule fences any other open checkout holding the same amount
  // inside an overlapping intent window.
  let nextMinor = 1000;
  const create = (member, amount = String(nextMinor++)) => request(member, 'POST', { expectedRevision: 0, amountMinor: amount });
  const cancel = (member, id) => request(member, 'POST', { cancelId: id });
  const row = async id => (await pool.query('select * from public.velo_topups where id=$1', [id])).rows[0];
  const creditOperations = async (familyId, depositId) => Number((await pool.query(
    "select count(*) from public.money_operations where family_id=$1 and request_key=$2 and purpose='deposit_credit'",
    [familyId, depositId],
  )).rows[0].count);
  async function pending(member) {
    const { data, error } = await service.rpc('admit_velo_deposit', {
      p_family: member.family_id, p_parent: member.user_id, p_key: randomUUID(),
      p_revision: 0, p_amount_minor: 1000, p_receiver: receiver,
    });
    assert.equal(error, null);
    return data.deposit;
  }
  function setPaid(deposit, { receipt = true } = {}) {
    const intent = intents.get(deposit.intentId);
    Object.assign(intent, { status: 'paid', payerAddress: operator });
    const hash = randomBytes(32).toString('hex');
    payments = receipt ? [payment(intent.amount, hash, intent.createdAt)] : [];
    transactionRecord = receipt ? transaction(hash, 5726509) : null;
    return hash;
  }

  stage = 'pending without a checkout cancels cleanly and releases admission';
  const pendingRow = await pending(a);
  const clean = await cancel(a, pendingRow.id);
  assert.equal(clean.statusCode, 200);
  assert.equal(clean.body.status, 'cancelled');
  assert.equal(clean.body.cancellationState, 'resolved');
  assert.equal(clean.body.checkoutUrl, null);
  assert.equal((await row(pendingRow.id)).status, 'cancelled');
  assert.equal((await cancel(a, pendingRow.id)).statusCode, 200);
  assert.equal((await create(a)).statusCode, 201);

  stage = 'fenced checkout hides its URL and blocks replacement until Velo proves it dead';
  const fencedDeposit = await create(b);
  assert.equal(fencedDeposit.statusCode, 201);
  const callsBeforeCancel = createCalls;
  const fenced = await cancel(b, fencedDeposit.body.id);
  assert.equal(fenced.statusCode, 200);
  assert.equal(fenced.body.status, 'cancelled');
  assert.equal(fenced.body.cancellationState, 'fenced');
  assert.equal(fenced.body.checkoutUrl, null);
  assert.equal((await row(fencedDeposit.body.id)).status, 'created');
  assert.equal(createCalls, callsBeforeCancel);
  assert.equal((await create(b)).statusCode, 409);
  assert.equal(createCalls, callsBeforeCancel);
  const stillFenced = await get(b);
  assert.equal(stillFenced.body.topups.find(item => item.id === fencedDeposit.body.id).cancellationState, 'fenced');
  Object.assign(intents.get(fencedDeposit.body.intentId), { status: 'expired' });
  const resolved = await get(b);
  assert.equal(resolved.body.topups.find(item => item.id === fencedDeposit.body.id).cancellationState, 'resolved');
  assert.equal((await row(fencedDeposit.body.id)).status, 'cancelled');
  assert.equal((await create(b)).statusCode, 201);

  stage = 'a verified late payment supersedes cancellation and credits exactly once';
  const lateDeposit = await create(c);
  assert.equal((await cancel(c, lateDeposit.body.id)).statusCode, 200);
  const lateHash = setPaid(lateDeposit.body);
  const late = await get(c);
  const lateRow = late.body.topups.find(item => item.id === lateDeposit.body.id);
  assert.equal(lateRow.status, 'paid');
  assert.equal(lateRow.cancellationState, 'superseded');
  assert.equal(lateRow.checkoutUrl, null);
  assert.equal(lateRow.verificationStatus, 'verified');
  assert.equal(lateRow.txHash, lateHash);
  assert.equal(lateRow.spendable, false, 'a receipt is not spendable before its credit confirms');
  assert.equal(lateRow.creditStatus, 'awaiting_credit');
  assert.equal((await row(lateDeposit.body.id)).status, 'paid');
  assert.equal((await row(lateDeposit.body.id)).cancelled_at, null);
  // DEC-140: the superseded receipt releases admission instead of blocking forever.
  assert.equal((await create(c)).statusCode, 201);
  const lateCredit = await creditVeloDeposit(coordinator, {
    depositId: lateDeposit.body.id, familyId: c.family_id, parentId: c.user_id, sourceAccount: source,
    resolveDestination: async () => ({ address: parentWallet, network: 'testnet' }),
    dispatch: async () => ({ phase: 'dispatching', observation: 'unavailable' }),
    prepare: async () => { throw Error('SHOULD_NOT_PREPARE'); },
  });
  assert.equal(lateCredit.confirmed, false);
  assert.equal(await creditOperations(c.family_id, lateDeposit.body.id), 1);
  const lateReplay = await creditVeloDeposit(coordinator, {
    depositId: lateDeposit.body.id, familyId: c.family_id, parentId: c.user_id, sourceAccount: source,
    resolveDestination: async () => ({ address: parentWallet, network: 'testnet' }),
    dispatch: async () => ({ phase: 'dispatching', observation: 'unavailable' }),
    prepare: async () => { throw Error('SHOULD_NOT_PREPARE'); },
  });
  assert.equal(lateReplay.operationId, lateCredit.operationId);
  assert.equal(await creditOperations(c.family_id, lateDeposit.body.id), 1);
  const refusedLate = await cancel(c, lateDeposit.body.id);
  assert.equal(refusedLate.statusCode, 409);
  assert.equal(refusedLate.body.error.code, 'CREDIT_STARTED');

  stage = 'an unverifiable late payment stays fenced and blocks admission';
  const ambiguousLate = await create(i);
  assert.equal((await cancel(i, ambiguousLate.body.id)).statusCode, 200);
  setPaid(ambiguousLate.body, { receipt: false });
  const ambiguous = await get(i);
  const ambiguousRow = ambiguous.body.topups.find(item => item.id === ambiguousLate.body.id);
  assert.equal(ambiguousRow.status, 'cancelled');
  assert.equal(ambiguousRow.cancellationState, 'late_paid');
  assert.equal(ambiguousRow.verificationStatus, 'unavailable');
  assert.equal(ambiguousRow.txHash, undefined);
  assert.notEqual((await row(ambiguousLate.body.id)).cancelled_at, null);
  assert.equal((await create(i)).statusCode, 409);
  await assert.rejects(creditVeloDeposit(coordinator, {
    depositId: ambiguousLate.body.id, familyId: i.family_id, parentId: i.user_id, sourceAccount: source,
    resolveDestination: async () => { throw Error('SHOULD_NOT_RESOLVE'); },
    dispatch: async () => { throw Error('SHOULD_NOT_DISPATCH'); },
    prepare: async () => { throw Error('SHOULD_NOT_PREPARE'); },
  }), { code: 'DEPOSIT_CANCELLED' });
  assert.equal(await creditOperations(i.family_id, ambiguousLate.body.id), 0);

  stage = 'confirmed payment wins over cancellation';
  const paidDeposit = await create(d);
  setPaid(paidDeposit.body);
  const confirmed = await get(d);
  assert.equal(confirmed.body.topups.find(item => item.id === paidDeposit.body.id).verificationStatus, 'verified');
  const refusedConfirmed = await cancel(d, paidDeposit.body.id);
  assert.equal(refusedConfirmed.statusCode, 409);
  assert.equal(refusedConfirmed.body.error.code, 'CONFIRMED');
  assert.equal((await row(paidDeposit.body.id)).cancelled_at, null);

  stage = 'paid but unverified payment also blocks cancellation';
  const paidUnverified = await create(e);
  setPaid(paidUnverified.body, { receipt: false });
  const observedUnverified = await get(e);
  assert.equal(observedUnverified.body.topups.find(item => item.id === paidUnverified.body.id).verificationStatus, 'unavailable');
  const refusedStarted = await cancel(e, paidUnverified.body.id);
  assert.equal(refusedStarted.statusCode, 409);
  assert.equal(refusedStarted.body.error.code, 'PAYMENT_STARTED');
  assert.equal((await row(paidUnverified.body.id)).cancelled_at, null);

  stage = 'unknown stays blocked and another family cannot cancel';
  failCreate = true;
  const unknown = await create(f);
  failCreate = false;
  assert.equal(unknown.body.status, 'unknown');
  const refusedUnknown = await cancel(f, unknown.body.id);
  assert.equal(refusedUnknown.statusCode, 409);
  assert.equal(refusedUnknown.body.error.code, 'STATUS_UNKNOWN');
  const foreign = await create(g);
  const refusedForeign = await cancel(f, foreign.body.id);
  assert.equal(refusedForeign.statusCode, 404);
  assert.equal(refusedForeign.body.error.code, 'NOT_FOUND');
  assert.equal((await row(foreign.body.id)).cancelled_at, null);

  stage = 'concurrent cancellation and credit cannot both win';
  const raceDeposit = await create(h);
  setPaid(raceDeposit.body);
  assert.equal((await get(h)).body.topups.find(item => item.id === raceDeposit.body.id).verificationStatus, 'verified');
  const [raceCancel, raceCredit] = await Promise.all([
    cancel(h, raceDeposit.body.id),
    creditVeloDeposit(coordinator, {
      depositId: raceDeposit.body.id, familyId: h.family_id, parentId: h.user_id, sourceAccount: source,
      resolveDestination: async () => ({ address: parentWallet, network: 'testnet' }),
      dispatch: async () => ({ phase: 'dispatching', observation: 'unavailable' }),
      prepare: async () => { throw Error('SHOULD_NOT_PREPARE'); },
    }).then(value => ({ value }), error => ({ error })),
  ]);
  if (raceCancel.statusCode === 200) {
    assert.equal(raceCredit.error?.code, 'DEPOSIT_CANCELLED');
    assert.equal(await creditOperations(h.family_id, raceDeposit.body.id), 0);
    assert.notEqual((await row(raceDeposit.body.id)).cancelled_at, null);
  } else {
    assert.equal(raceCancel.statusCode, 409);
    assert.ok(['CONFIRMED', 'CREDIT_STARTED'].includes(raceCancel.body.error.code));
    assert.ok(raceCredit.value, `credit failed: ${raceCredit.error?.code}`);
    assert.equal(await creditOperations(h.family_id, raceDeposit.body.id), 1);
    assert.equal((await row(raceDeposit.body.id)).cancelled_at, null);
  }

  stage = 'an admitted credit blocks cancellation';
  const creditDeposit = await create(d);
  setPaid(creditDeposit.body);
  assert.equal((await get(d)).body.topups.find(item => item.id === creditDeposit.body.id).verificationStatus, 'verified');
  const pendingCredit = await creditVeloDeposit(coordinator, {
    depositId: creditDeposit.body.id, familyId: d.family_id, parentId: d.user_id, sourceAccount: source,
    resolveDestination: async () => ({ address: parentWallet, network: 'testnet' }),
    dispatch: async () => ({ phase: 'dispatching', observation: 'unavailable' }),
    prepare: async () => { throw Error('SHOULD_NOT_PREPARE'); },
  });
  assert.equal(pendingCredit.confirmed, false);
  assert.equal(await creditOperations(d.family_id, creditDeposit.body.id), 1);
  const refusedCredit = await cancel(d, creditDeposit.body.id);
  assert.equal(refusedCredit.statusCode, 409);
  assert.equal(refusedCredit.body.error.code, 'CREDIT_STARTED');
  assert.equal((await row(creditDeposit.body.id)).cancelled_at, null);

  passed = true;
  console.log('PASS: deposit-cancel (loopback Postgres and API handler; simulated Velo/Horizon; no live payment)');
} catch (error) {
  const line = /verify-deposit-cancel\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  console.error(`FAIL: deposit-cancel (${stage}; ${error.code ?? error.name}${line ? `; line ${line}` : ''})`);
} finally {
  try {
    const ids = members.map(member => member.user_id);
    if (ids.length) {
      await pool.query('delete from public.velo_topups where parent_id=any($1::uuid[])', [ids]);
      await pool.query('delete from public.family_members where user_id=any($1::uuid[])', [ids]);
      for (const id of ids) assert.equal((await service.auth.admin.deleteUser(id)).error, null);
    }
  } catch {
    passed = false;
    if (members.length) console.error('FAIL: deposit-cancel (fixture cleanup)');
  } finally { await pool?.end(); }
}
if (!passed) process.exitCode = 1;
