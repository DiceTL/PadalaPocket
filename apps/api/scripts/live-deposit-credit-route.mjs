import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import pg from 'pg';
import { Keypair, rpc } from '@stellar/stellar-sdk';
import { buildDepositCreditTransfer } from '../src/velo-deposit-credit.mjs';
import { createDepositCreditRoute } from '../src/velo-deposit-credit-route.mjs';
import { createIsolatedFinancialHandler } from '../src/money-coordinator-handler.mjs';
import { guardedDispatcher } from '../src/money-guarded-dispatch.mjs';
import { veloTopups } from '../src/velo-topups.mjs';
import { HORIZON_TESTNET, xlmToStroops } from '../src/velo-receipts.mjs';
import { assertLoopbackBindings, coordinatorConfiguration } from './local-verification.mjs';

// DEC-143: one real Testnet credit through the T38 route. Deposit D was paid,
// cancelled and paid again; it is superseded, so the trusted credit path may
// pay it once. The destination is family custody, never caller input.
const DEPOSIT_STATE = new URL('../../../.env.t14-t17-live.json', import.meta.url);
const SOURCE_STATE = new URL('../../../.env.t38-live.json', import.meta.url);
const HORIZON = HORIZON_TESTNET;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
let stage = 'arguments', passed = false, pool, service, coordinator, summary = {};
let ledgerServer;

async function horizon(path, init) {
  const response = await fetch(`${HORIZON}${path}`, { redirect: 'error', signal: AbortSignal.timeout(20000), ...init });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}
const nativeStroops = account => xlmToStroops(account.balances.find(balance => balance.asset_type === 'native').balance);
async function balanceOf(address) {
  const { body } = await horizon(`/accounts/${address}`);
  return nativeStroops(body);
}
async function waitForAccount(address) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const { response, body } = await horizon(`/accounts/${address}`);
    if (response.ok) return body;
    await sleep(1500);
  }
  throw Error('custody destination did not appear on Horizon');
}

try {
  stage = 'state';
  const deposit = JSON.parse(await readFile(DEPOSIT_STATE, 'utf8'));
  const sourceState = JSON.parse(await readFile(SOURCE_STATE, 'utf8'));
  assert.ok(deposit.d?.depositId, 'state file has no deposit D');
  const source = Keypair.fromSecret(sourceState.sourceSecret);
  const guard = Keypair.fromSecret(sourceState.guardSecret);
  const receiver = Keypair.fromSecret(process.env.OWNER_SECRET).publicKey();

  stage = 'loopback';
  assertLoopbackBindings();
  const local = await coordinatorConfiguration();
  service = local.legacy;
  coordinator = local.admin;
  pool = new pg.Pool({ connectionString: local.status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });

  stage = 'family custody';
  const parent = (await pool.query('select user_id,role,wallet_ready from public.family_members where family_id=$1 and role=\'parent\'', [deposit.d.familyId])).rows[0];
  assert.ok(parent, 'deposit D family has no parent');
  let custody = (await pool.query(
    `select public_address from wallet_custody.family_signing_keys
     where family_id=$1 and signer_role='parent' and network='testnet' order by key_version desc limit 1`,
    [deposit.d.familyId],
  )).rows[0];
  let generatedSecret;
  if (!custody) {
    const generated = Keypair.random();
    generatedSecret = generated.secret();
    await pool.query(`insert into wallet_custody.family_signing_keys
      (family_id,signer_role,network,public_address,key_version,vault_secret_id)
      values($1,'parent','testnet',$2,1,vault.create_secret($3))`,
    [deposit.d.familyId, generated.publicKey(), generatedSecret]);
    custody = { public_address: generated.publicKey() };
  }
  const destination = Keypair.fromPublicKey(custody.public_address);
  const provisioned = (await pool.query(
    'select 1 from wallet_custody.family_provisions where family_id=$1 and completed_at is not null',
    [deposit.d.familyId],
  )).rows[0];
  if (!provisioned) {
    let student = (await pool.query(
      "select user_id from public.family_members where family_id=$1 and role='student' limit 1",
      [deposit.d.familyId],
    )).rows[0];
    if (!student) {
      const email = `t38-live-student-${randomUUID()}@example.test`;
      const created = await service.auth.admin.createUser({
        email, password: local.password(email), email_confirm: true,
      });
      assert.equal(created.error, null);
      await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'student')",
        [created.data.user.id, deposit.d.familyId]);
      student = { user_id: created.data.user.id };
    }
    const operation = (await pool.query(`insert into public.money_operations
      (family_id,actor_id,request_key,purpose,network,asset,source_ref,destination_ref,
       amount_stroops,request_payload,request_fingerprint)
      values($1::uuid,$2,$3,'device_setup','testnet','native','project:setup','family:'||$1::text,'0','{}',$4)
      returning id`, [deposit.d.familyId, parent.user_id, randomUUID(), '0'.repeat(64)])).rows[0];
    await pool.query('insert into wallet_custody.family_provisions(family_id,operation_id,completed_at) values($1,$2,now())',
      [deposit.d.familyId, operation.id]);
  }

  stage = 'destination funding';
  let destinationAccount = null;
  try { destinationAccount = await waitForAccount(destination.publicKey()); } catch {
    const funded = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(destination.publicKey())}`, {
      redirect: 'error', signal: AbortSignal.timeout(30000),
    });
    assert.equal(funded.ok, true, 'Friendbot could not fund the custody destination');
    destinationAccount = await waitForAccount(destination.publicKey());
  }
  const beforeStroops = nativeStroops(destinationAccount);

  stage = 'route';
  const token = randomBytes(32).toString('hex');
  const server = new rpc.Server('https://soroban-testnet.stellar.org', { timeout: 15000 });
  const dispatch = guardedDispatcher({
    database: coordinator, guard, server,
    readAccount: async address => (await horizon(`/accounts/${address}`)).body,
  });
  const prepare = async context => {
    const current = (await horizon(`/accounts/${context.sourceAccount}`)).body;
    return buildDepositCreditTransfer({ ...context, sequence: current.sequence, signer: source });
  };
  const resolveDestination = async ({ familyId, parentId }) => {
    const { data, error } = await coordinator.rpc('resolve_family_parent_destination', { p_family: familyId, p_parent: parentId });
    if (error) throw error;
    if (!data) throw Error('DESTINATION_UNAVAILABLE');
    return data;
  };
  const route = createDepositCreditRoute({
    database: coordinator, sourceAccount: source.publicKey(), resolveDestination, dispatch, prepare,
  });
  const handler = createIsolatedFinancialHandler({ token, database: coordinator, depositCredit: route });
  ledgerServer = createServer(handler);
  ledgerServer.listen(0, '127.0.0.1');
  await once(ledgerServer, 'listening');
  const origin = new URL(`http://127.0.0.1:${ledgerServer.address().port}`);
  const call = body => fetch(new URL('/api/velo-topups/deposit-credit', origin), {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-money-coordinator-token': token },
    body: JSON.stringify(body), redirect: 'error',
  });

  stage = 'unauthenticated refusal';
  const anonymous = await fetch(new URL('/api/velo-topups/deposit-credit', origin), {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ depositId: deposit.d.depositId }),
  });
  assert.equal(anonymous.status, 403);

  stage = 'cross-family refusal';
  const foreign = await call({ depositId: deposit.d.depositId, familyId: deposit.c.familyId });
  assert.equal(foreign.status, 404);

  stage = 'live credit';
  let credited = await call({ depositId: deposit.d.depositId });
  let result = await credited.json();
  for (let attempt = 0; attempt < 4 && !result.confirmed; attempt++) {
    await sleep(5000);
    credited = await call({ depositId: deposit.d.depositId });
    result = await credited.json();
  }
  assert.equal(credited.status, 200, JSON.stringify(result));
  assert.equal(result.confirmed, true, `credit is ${result.status}`);
  assert.match(result.transactionHash, /^[a-f0-9]{64}$/);
  assert.ok(Number(result.confirmedLedger) > 0);

  stage = 'single operation';
  const operations = (await pool.query(
    `select id,actor_id,source_ref,destination_ref,amount_stroops,request_payload
     from public.money_operations where family_id=$1 and request_key=$2 and purpose='deposit_credit'`,
    [deposit.d.familyId, deposit.d.depositId],
  )).rows;
  assert.equal(operations.length, 1);
  assert.equal(operations[0].source_ref, `project:${source.publicKey()}`);
  assert.equal(operations[0].destination_ref, `family:${deposit.d.familyId}:parent`);
  assert.equal(operations[0].amount_stroops, '10330579');
  assert.equal(operations[0].request_payload.depositId, deposit.d.depositId);
  const steps = (await pool.query(
    `select d.phase,s.transaction_hash from public.money_dispatch_steps d
     join public.money_signed_steps s on s.operation_id=d.operation_id and s.step_key=d.step_key
     where d.operation_id=$1 and d.step_key='credit'`, [operations[0].id],
  )).rows;
  assert.deepEqual(steps, [{ phase: 'confirmed', transaction_hash: result.transactionHash }]);

  stage = 'real transfer';
  const { body: transfer } = await horizon(`/transactions/${result.transactionHash}`);
  assert.equal(transfer.successful, true);
  assert.equal(transfer.source_account, source.publicKey());
  assert.equal(String(transfer.ledger), result.confirmedLedger);
  const { body: transferOperations } = await horizon(`/transactions/${result.transactionHash}/operations`);
  const payments = transferOperations._embedded.records.filter(record => record.type === 'payment');
  assert.equal(payments.length, 1);
  assert.equal(payments[0].from, source.publicKey());
  assert.equal(payments[0].to, destination.publicKey());
  assert.equal(payments[0].asset_type, 'native');
  assert.equal(xlmToStroops(payments[0].amount), 10330579n);

  stage = 'destination delta';
  const afterStroops = await balanceOf(destination.publicKey());
  assert.equal(afterStroops - beforeStroops, 10330579n);

  stage = 'replay sends nothing';
  const replayed = await (await call({ depositId: deposit.d.depositId })).json();
  assert.equal(replayed.operationId, result.operationId);
  assert.equal(replayed.transactionHash, result.transactionHash);
  const { body: recent } = await horizon(`/accounts/${source.publicKey()}/payments?order=desc&limit=50`);
  const outbound = recent._embedded.records.filter(record => record.type === 'payment'
    && record.asset_type === 'native' && record.from === source.publicKey());
  assert.equal(outbound.length, 1, 'the payout source must send exactly one payment');

  stage = 'projection';
  const member = { family_id: deposit.d.familyId, user_id: parent.user_id, role: 'parent' };
  const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
  await veloTopups({ method: 'GET', headers: {} }, res, {
    authenticate: async () => ({ member }), database: () => service, receiver: () => receiver,
    provider: () => { throw Error('PROVIDER_MUST_NOT_RUN'); },
    operator: () => Keypair.fromPublicKey(deposit.operator).publicKey(),
    horizon: async () => { throw Error('HORIZON_MUST_NOT_RUN'); },
  });
  assert.equal(res.statusCode, 200, JSON.stringify(res.body));
  const row = res.body.topups.find(item => item.id === deposit.d.depositId);
  assert.equal(row.status, 'paid');
  assert.equal(row.cancellationState, 'superseded');
  assert.equal(row.creditStatus, 'confirmed');
  assert.equal(row.spendable, true);
  assert.equal(row.creditTxHash, result.transactionHash);
  assert.equal(res.body.parentBalance.confirmedDepositStroops, '10330579');
  assert.equal(res.body.parentBalance.pendingDepositStroops, '0');

  stage = 'state';
  await writeFile(SOURCE_STATE, `${JSON.stringify({
    ...sourceState, destination: destination.publicKey(),
    ...(generatedSecret ? { destinationSecret: generatedSecret } : {}),
    credit: {
      depositId: deposit.d.depositId, operationId: result.operationId, transactionHash: result.transactionHash,
      ledger: result.confirmedLedger, amountStroops: '10330579',
    },
  }, null, 2)}\n`, { mode: 0o600 });

  summary = {
    decision: 'DEC-143', network: 'testnet',
    source: source.publicKey(), guard: guard.publicKey(), destination: destination.publicKey(),
    depositId: deposit.d.depositId, operationId: result.operationId,
    transactionHash: result.transactionHash, ledger: result.confirmedLedger, amountStroops: '10330579',
    outboundPaymentsFromSource: outbound.length,
    projection: {
      confirmedDepositStroops: res.body.parentBalance.confirmedDepositStroops,
      pendingDepositStroops: res.body.parentBalance.pendingDepositStroops,
    },
    spendable: row.spendable,
  };
  passed = true;
  console.log('PASS: live-deposit-credit-route (real coordinator route, custody resolver and Testnet transfer; one confirmed credit)');
  console.log(JSON.stringify(summary, null, 2));
} catch (error) {
  const line = /live-deposit-credit-route\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  const message = error.code === 'ERR_ASSERTION' ? `${error.code}: ${error.message}` : (error.code ?? error.message);
  console.error(`FAIL: live-deposit-credit-route (${stage}; ${message}${line ? `; line ${line}` : ''})`);
} finally {
  if (ledgerServer) await new Promise(resolve => ledgerServer.close(resolve));
  await pool?.end();
  if (!passed) process.exitCode = 1;
}
