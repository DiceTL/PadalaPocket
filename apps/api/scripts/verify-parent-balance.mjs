import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { Keypair } from '@stellar/stellar-sdk';
import { veloTopups } from '../src/velo-topups.mjs';
import { assertLoopbackBindings, localConfiguration } from './local-verification.mjs';

// T17 projects confirmed journal credits and allocation reservations. No wallet
// balance, reserve, operating float or signed envelope is read.
let pool, service, stage = 'loopback';
let passed = false;
const members = [];
try {
  assertLoopbackBindings();
  const { status, admin: client, password } = await localConfiguration();
  service = client;
  const url = new URL(status.DB_URL);
  assert.equal(url.protocol, 'postgresql:');
  assert.equal(url.host, '127.0.0.1:54332');
  pool = new pg.Pool({ connectionString: status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });

  async function parent() {
    const email = `balance-${randomUUID()}@example.test`;
    const created = await service.auth.admin.createUser({ email, password: password(email), email_confirm: true });
    assert.equal(created.error, null);
    const member = { family_id: randomUUID(), user_id: created.data.user.id, role: 'parent' };
    members.push(member);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent')", [member.user_id, member.family_id]);
    return member;
  }

  const [a, b] = await Promise.all([parent(), parent()]);
  const receiver = Keypair.random().publicKey();
  const payer = Keypair.random().publicKey();

  async function topup(member, { amountStroops = '10000000', verified = true, cancelled = false } = {}) {
    const id = randomUUID();
    const txHash = verified ? randomBytes(32).toString('hex') : null;
    await pool.query(`insert into public.velo_topups
      (id,family_id,parent_id,request_key,rules_revision,amount_stroops,expected_receiver,amount_minor,
       mapping_version,status,tx_hash,payer_address,verification_status,verified_at,verified_ledger,
       cancelled_at,cancellation_state)
      values($1,$2,$3,$4,0,$5,$6,1000,'php-xlm-20261107-v1',$7,$8,$9,$10,$11,$12,$13,$14)`, [
      id, member.family_id, member.user_id, randomUUID(), amountStroops, receiver,
      cancelled ? 'created' : 'paid', txHash, verified ? payer : null, verified ? 'verified' : 'unverified',
      verified ? new Date().toISOString() : null, verified ? 5726509 : null,
      cancelled ? new Date().toISOString() : null, cancelled ? 'late_paid' : 'none',
    ]);
    return { id, txHash };
  }

  async function credit(member, depositId, { phase = 'confirmed', amountStroops = '10000000' } = {}) {
    const operationId = randomUUID(), source = Keypair.random().publicKey(), transactionHash = randomBytes(32).toString('hex');
    await pool.query(`insert into public.money_operations
      (id,family_id,actor_id,request_key,purpose,network,asset,source_ref,destination_ref,
       amount_stroops,request_payload,request_fingerprint)
      values($1,$2,$3,$4,'deposit_credit','testnet','native',$5,$6,$7,$8,$9)`, [
      operationId, member.family_id, member.user_id, depositId, `project:${source}`,
      `family:${member.family_id}:parent`, amountStroops, JSON.stringify({ depositId }), '0'.repeat(64),
    ]);
    await pool.query('insert into public.money_reservations(operation_id) values($1)', [operationId]);
    if (phase !== 'reserved') {
      await pool.query(`insert into public.money_signed_steps
        (operation_id,step_key,network,source_account,transaction_hash,signed_envelope)
        values($1,'credit','testnet',$2,$3,'AAAA')`, [operationId, source, transactionHash]);
      await pool.query(`insert into public.money_dispatch_steps
        (operation_id,step_key,network,source_account,preparation_claim,dispatch_claim,phase,confirmed_ledger,confirmed_result_xdr)
        values($1,'credit','testnet',$2,$3,$4,$5,$6,$7)`, [
        operationId, source, randomUUID(), randomUUID(), phase,
        phase === 'confirmed' ? 123 : null, phase === 'confirmed' ? 'AAAA' : null,
      ]);
    }
    return { operationId, transactionHash };
  }

  async function funding(member, { status, total, amount = total, wants = '0' }) {
    await pool.query(`insert into public.needs_funding
      (id,family_id,parent_id,request_key,price_minor,amount_stroops,mapping_version,device_hash,
       status,steps,total_stroops,wants_stroops,wants_device_hash,rules_revision)
      values($1,$2,$3,$4,'968',$5,'php-xlm-20261107-v1',$6,$7,'{}',$8,$9,$10,0)`, [
      randomUUID(), member.family_id, member.user_id, randomUUID(), amount,
      randomBytes(32).toString('hex'), status, total, wants, randomBytes(32).toString('hex'),
    ]);
  }

  async function get(member) {
    const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
    await veloTopups({ method: 'GET', headers: {} }, res, {
      authenticate: async () => ({ member }), database: () => service,
      receiver: () => receiver, provider: () => { throw Error('PROVIDER_MUST_NOT_RUN'); },
    });
    return res;
  }

  stage = 'confirmed T15 credit is spendable; verified awaiting credit is not';
  const confirmed = await topup(a, { amountStroops: '10000000' });
  const pending = await topup(a, { amountStroops: '5000000' });
  const awaiting = await topup(a, { amountStroops: '3000000' });
  const unverified = await topup(a, { amountStroops: '2000000', verified: false });
  const cancelled = await topup(a, { amountStroops: '4000000', cancelled: true });
  const confirmedCredit = await credit(a, confirmed.id, { amountStroops: '10000000' });
  await credit(a, pending.id, { phase: 'dispatching', amountStroops: '5000000' });
  await pool.query("delete from public.needs_funding where status in ('processing','unknown')");
  await funding(a, { status: 'confirmed', total: '4000000' });
  await funding(a, { status: 'processing', total: '1000000' });
  await funding(a, { status: 'failed', total: '2000000' });

  const other = await topup(b, { amountStroops: '9000000' });
  await credit(b, other.id, { amountStroops: '9000000' });

  const res = await get(a);
  assert.equal(res.statusCode, 200);
  const byId = new Map(res.body.topups.map(item => [item.id, item]));
  assert.equal(byId.get(confirmed.id).status, 'paid');
  assert.equal(byId.get(confirmed.id).creditStatus, 'confirmed');
  assert.equal(byId.get(confirmed.id).spendable, true);
  assert.equal(byId.get(confirmed.id).creditTxHash, confirmedCredit.transactionHash);
  assert.equal(byId.get(confirmed.id).creditLedger, '123');
  assert.equal(byId.get(pending.id).status, 'paid');
  assert.equal(byId.get(pending.id).creditStatus, 'pending');
  assert.equal(byId.get(pending.id).spendable, false);
  assert.equal(byId.get(awaiting.id).status, 'paid');
  assert.equal(byId.get(awaiting.id).creditStatus, 'awaiting_credit');
  assert.equal(byId.get(awaiting.id).spendable, false);
  assert.equal(byId.get(unverified.id).creditStatus, 'unverified');
  assert.equal(byId.get(unverified.id).spendable, false);
  assert.equal(byId.get(cancelled.id).status, 'cancelled');
  assert.equal(byId.get(cancelled.id).creditStatus, 'cancelled');
  assert.equal(byId.get(cancelled.id).spendable, false);

  assert.deepEqual(res.body.parentBalance, {
    confirmedDepositStroops: '10000000',
    pendingDepositStroops: '5000000',
    confirmedAllocationStroops: '4000000',
    pendingAllocationStroops: '1000000',
    confirmedHoldingsStroops: '6000000',
    availableStroops: '5000000',
    basis: 'confirmed_journal',
  });
  assert.equal(res.body.topups.length, 5);
  assert.equal(byId.has(other.id), false);

  stage = 'another family does not affect the projection';
  const otherRes = await get(b);
  assert.equal(otherRes.body.parentBalance.confirmedDepositStroops, '9000000');
  assert.equal(otherRes.body.parentBalance.availableStroops, '9000000');

  stage = 'an empty family projects zero';
  const empty = await parent();
  const emptyRes = await get(empty);
  assert.equal(emptyRes.body.parentBalance.confirmedDepositStroops, '0');
  assert.equal(emptyRes.body.parentBalance.pendingDepositStroops, '0');
  assert.equal(emptyRes.body.parentBalance.availableStroops, '0');
  assert.equal(emptyRes.body.parentBalance.basis, 'confirmed_journal');

  passed = true;
  console.log('PASS: parent-balance (loopback Postgres; confirmed journal projection; no wallet or live read)');
} catch (error) {
  const line = /verify-parent-balance\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  console.error(`FAIL: parent-balance (${stage}; ${error.code ?? error.name}${line ? `; line ${line}` : ''})`);
} finally {
  try {
    const ids = members.map(member => member.user_id);
    if (ids.length) {
      await pool.query('delete from public.velo_topups where parent_id=any($1::uuid[])', [ids]);
      await pool.query('delete from public.needs_funding where parent_id=any($1::uuid[])', [ids]);
      await pool.query('delete from public.family_members where user_id=any($1::uuid[])', [ids]);
      for (const id of ids) assert.equal((await service.auth.admin.deleteUser(id)).error, null);
    }
  } catch {
    passed = false;
    if (members.length) console.error('FAIL: parent-balance (fixture cleanup)');
  } finally { await pool?.end(); }
}
if (!passed) process.exitCode = 1;
