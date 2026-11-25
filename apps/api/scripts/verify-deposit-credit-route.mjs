import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { Keypair, Networks, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { buildDepositCreditTransfer } from '../src/velo-deposit-credit.mjs';
import { createDepositCreditRoute } from '../src/velo-deposit-credit-route.mjs';
import { createIsolatedFinancialHandler } from '../src/money-coordinator-handler.mjs';
import { guardedDispatcher } from '../src/money-guarded-dispatch.mjs';
import { isFinancialPath } from '../src/money-proxy.mjs';
import { assertLoopbackBindings, coordinatorConfiguration } from './local-verification.mjs';

// T38 drives the real coordinator route, custody resolver and T05/T06 credit
// path. The ledger is simulated; a pass is not evidence of a deployed or live call.
let pool, coordinator, service, ledgerServer, serverError, stage = 'loopback';
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
    const email = `credit-route-${randomUUID()}@example.test`;
    const created = await service.auth.admin.createUser({ email, password: password(email), email_confirm: true });
    assert.equal(created.error, null);
    const member = { family_id: randomUUID(), user_id: created.data.user.id, role: 'parent' };
    members.push(member);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent')", [member.user_id, member.family_id]);
    return member;
  }
  // A provision slot requires the linked student that T12 admission expects.
  async function addStudent(member) {
    const email = `credit-route-student-${randomUUID()}@example.test`;
    const created = await service.auth.admin.createUser({ email, password: password(email), email_confirm: true });
    assert.equal(created.error, null);
    const student = { family_id: member.family_id, user_id: created.data.user.id, role: 'student' };
    members.push(student);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'student')", [student.user_id, student.family_id]);
    return student;
  }
  // Custody binding plus a completed provision: the only resolvable destination.
  async function provision(member, wallet, { completed = true } = {}) {
    await pool.query(`insert into wallet_custody.family_signing_keys
      (family_id,signer_role,network,public_address,key_version,vault_secret_id)
      values($1,'parent','testnet',$2,1,vault.create_secret($3))`, [member.family_id, wallet.publicKey(), wallet.secret()]);
    if (!completed) return;
    const operation = (await pool.query(`insert into public.money_operations
      (family_id,actor_id,request_key,purpose,network,asset,source_ref,destination_ref,
       amount_stroops,request_payload,request_fingerprint)
      values($1::uuid,$2,$3,'device_setup','testnet','native','project:setup','family:'||$1::text,'0','{}',$4)
      returning id`, [member.family_id, member.user_id, randomUUID(), '0'.repeat(64)])).rows[0];
    await pool.query('insert into wallet_custody.family_provisions(family_id,operation_id,completed_at) values($1,$2,now())',
      [member.family_id, operation.id]);
  }

  const [a, b, unprovisioned] = await Promise.all([parent(), parent(), parent()]);
  await Promise.all([addStudent(a), addStudent(b)]);
  const walletA = Keypair.random(), walletB = Keypair.random(), walletC = Keypair.random();
  await provision(a, walletA);
  await provision(b, walletB);
  await provision(unprovisioned, walletC, { completed: false });

  const receiver = Keypair.random().publicKey();
  const source = Keypair.random();
  const guard = Keypair.random();
  const sourceAccount = source.publicKey();
  const nowMs = Date.now();
  const now = () => nowMs;
  let sequence = 0, prepares = 0;
  const payments = [];
  serverError = null;
  const account = {
    account_id: sourceAccount,
    thresholds: { low_threshold: 2, med_threshold: 2, high_threshold: 2 },
    signers: [sourceAccount, guard.publicKey()].map(key => ({ key, weight: 1, type: 'ed25519_public_key' })),
  };
  const resultXdr = new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString('100'),
    result: xdr.TransactionResultResult.txSuccess([
      xdr.OperationResult.opInner(xdr.OperationResultTr.payment(xdr.PaymentResult.paymentSuccess())),
    ]),
    ext: new xdr.TransactionResultExt(0),
  }).toXDR('base64');

  ledgerServer = createServer(async (req, res) => {
    try {
      let text = '';
      for await (const part of req) text += part;
      const body = JSON.parse(text);
      res.setHeader('Content-Type', 'application/json');
      if (body.method === 'sendTransaction') {
        const tx = TransactionBuilder.fromXDR(body.params.transaction, Networks.TESTNET);
        const [operation] = tx.operations;
        const hash = tx.hash().toString('hex');
        assert.equal(tx.source, sourceAccount);
        assert.equal(tx.operations.length, 1);
        assert.equal(operation.type, 'payment');
        assert.equal(operation.asset.isNative(), true);
        assert.equal(tx.signatures.length, 2);
        for (const key of [source, guard]) assert.ok(tx.signatures.some(signature => key.verify(tx.hash(), signature.signature())));
        payments.push({ hash, destination: operation.destination, amount: operation.amount, envelope: tx.toXDR() });
        res.end(JSON.stringify({
          jsonrpc: '2.0', id: body.id,
          result: { status: 'PENDING', hash, latestLedger: 124, latestLedgerCloseTime: 1 },
        }));
        return;
      }
      assert.equal(body.method, 'getTransaction');
      const payment = payments.find(item => item.hash === body.params.hash);
      assert.ok(payment, 'unknown transaction hash');
      res.end(JSON.stringify({
        jsonrpc: '2.0', id: body.id,
        result: {
          status: 'SUCCESS', txHash: payment.hash, latestLedger: 124, latestLedgerCloseTime: 1,
          oldestLedger: 1, oldestLedgerCloseTime: 0, ledger: 123, createdAt: 1,
          applicationOrder: 1, feeBump: false, envelopeXdr: payment.envelope, resultXdr,
          resultMetaXdr: new xdr.TransactionMeta(0, []).toXDR('base64'),
        },
      }));
    } catch (error) {
      serverError = error;
      res.statusCode = 500;
      res.end('{}');
    }
  });
  ledgerServer.listen(0, '127.0.0.1');
  await once(ledgerServer, 'listening');
  const ledger = new rpc.Server(`http://127.0.0.1:${ledgerServer.address().port}`, { allowHttp: true, timeout: 1000 });
  const dispatch = guardedDispatcher({ database: coordinator, guard, readAccount: async () => account, server: ledger, now });
  const prepare = async context => {
    prepares++;
    return buildDepositCreditTransfer({ ...context, sequence: String(sequence++), signer: source, now });
  };
  const resolveDestination = async ({ familyId, parentId }) => {
    const { data, error } = await coordinator.rpc('resolve_family_parent_destination', { p_family: familyId, p_parent: parentId });
    if (error) throw error;
    if (!data) throw Error('DESTINATION_UNAVAILABLE');
    return data;
  };
  const token = randomBytes(32).toString('hex');
  const route = createDepositCreditRoute({ database: coordinator, sourceAccount, resolveDestination, dispatch, prepare });
  const handler = createIsolatedFinancialHandler({ token, database: coordinator, depositCredit: route });
  const server = createServer(handler);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const origin = new URL(`http://127.0.0.1:${server.address().port}`);
  const call = (body, { authorized = true, method = 'POST' } = {}) => fetch(new URL('/api/velo-topups/deposit-credit', origin), {
    method,
    headers: { 'content-type': 'application/json', ...(authorized && { 'x-money-coordinator-token': token }) },
    body: method === 'POST' ? (typeof body === 'string' ? body : JSON.stringify(body)) : undefined,
    redirect: 'error',
  });

  async function deposit(member, { verified = true } = {}) {
    const id = randomUUID(), txHash = randomBytes(32).toString('hex');
    await pool.query(`insert into public.velo_topups
      (id,family_id,parent_id,request_key,rules_revision,amount_stroops,expected_receiver,amount_minor,
       mapping_version,status,tx_hash,payer_address,verification_status,verified_at,verified_ledger)
      values($1,$2,$3,$4,0,10331,$5,1000,'php-xlm-20261107-v1','paid',$6,$7,$8,$9,$10)`, [
      id, member.family_id, member.user_id, randomUUID(), receiver,
      verified ? txHash : null, verified ? Keypair.random().publicKey() : null,
      verified ? 'verified' : 'unverified', verified ? new Date(nowMs).toISOString() : null, verified ? 5726509 : null,
    ]);
    return { id, txHash };
  }
  const operations = async (member, depositId) => (await pool.query(
    `select id,source_ref,destination_ref,amount_stroops,request_payload from public.money_operations
     where family_id=$1 and request_key=$2 and purpose='deposit_credit'`, [member.family_id, depositId],
  )).rows;

  stage = 'the public proxy never reaches the coordinator credit route';
  assert.equal(isFinancialPath('/api/velo-topups/deposit-credit'), false);
  assert.equal(isFinancialPath('/api/velo-topups'), false);

  stage = 'unauthenticated and non-POST callers are refused without a send';
  const unauthenticated = await call({ depositId: randomUUID() }, { authorized: false });
  assert.equal(unauthenticated.status, 403);
  const get = await call(undefined, { method: 'GET' });
  assert.equal(get.status, 405);
  assert.equal(get.headers.get('allow'), 'POST');
  assert.equal(payments.length, 0);

  const creditA = await deposit(a);
  stage = 'caller-supplied amount, destination or signing material is refused';
  for (const body of [
    {}, { depositId: 'not-a-uuid' }, { depositId: creditA.id, amountStroops: '1' },
    { depositId: creditA.id, destinationAccount: walletB.publicKey() },
    { depositId: creditA.id, signedEnvelope: 'AAAA' },
    { depositId: creditA.id, network: 'public' },
  ]) {
    const refused = await call(body);
    assert.equal(refused.status, 400, JSON.stringify(body));
    assert.equal((await refused.json()).error.code, 'INVALID_INPUT');
  }
  assert.equal((await call('not json')).status, 400);
  assert.equal(await operations(a, creditA.id).then(rows => rows.length), 0);
  assert.equal(prepares, 0);

  stage = 'an unknown deposit or a mismatched owner is not credited';
  assert.equal((await call({ depositId: randomUUID() })).status, 404);
  assert.equal((await call({ depositId: creditA.id, familyId: b.family_id })).status, 404);
  assert.equal((await call({ depositId: creditA.id, parentId: b.user_id })).status, 404);
  assert.equal(prepares, 0);
  assert.equal(payments.length, 0);

  stage = 'an unverified receipt is refused';
  const unverified = await deposit(a, { verified: false });
  const refused = await call({ depositId: unverified.id });
  assert.equal(refused.status, 409);
  assert.equal((await refused.json()).error.code, 'DEPOSIT_NOT_VERIFIED');
  assert.equal(prepares, 0);

  stage = 'a verified receipt credits the exact family once';
  const credited = await call({ depositId: creditA.id });
  const result = await credited.json();
  assert.equal(credited.status, 200, JSON.stringify(result));
  assert.deepEqual(Object.keys(result).sort(), ['confirmed', 'confirmedLedger', 'operationId', 'status', 'transactionHash']);
  assert.equal(result.confirmed, true);
  assert.equal(result.status, 'confirmed');
  assert.equal(result.confirmedLedger, '123');
  assert.equal(payments.length, 1);
  assert.equal(payments[0].destination, walletA.publicKey());
  assert.equal(payments[0].amount, '0.0010331');
  assert.equal(result.transactionHash, payments[0].hash);
  assert.ok(!JSON.stringify(result).includes(walletA.secret()));
  assert.ok(!JSON.stringify(result).includes(source.secret()));

  const [operation] = await operations(a, creditA.id);
  assert.equal(operation.source_ref, `project:${sourceAccount}`);
  assert.equal(operation.destination_ref, `family:${a.family_id}:parent`);
  assert.equal(operation.amount_stroops, '10331');
  assert.deepEqual(operation.request_payload, {
    depositId: creditA.id, receiptTxHash: creditA.txHash, sourceAccount, destinationAccount: walletA.publicKey(),
  });

  stage = 'a repeated call reuses the reservation and sends nothing';
  const repeated = await (await call({ depositId: creditA.id })).json();
  assert.equal(repeated.operationId, result.operationId);
  assert.equal(repeated.transactionHash, result.transactionHash);
  assert.equal((await operations(a, creditA.id)).length, 1);
  assert.equal(payments.length, 1);
  assert.equal(prepares, 1);

  stage = "another family's deposit resolves to that family's own custody address";
  const creditB = await deposit(b);
  const other = await (await call({ depositId: creditB.id })).json();
  assert.equal(other.confirmed, true);
  assert.equal(payments.length, 2);
  assert.equal(payments[1].destination, walletB.publicKey());
  assert.equal((await operations(b, creditB.id))[0].destination_ref, `family:${b.family_id}:parent`);

  stage = 'a family without a completed provision has no trusted destination';
  const noProvision = await deposit(unprovisioned);
  const unresolved = await call({ depositId: noProvision.id });
  assert.equal(unresolved.status, 503);
  assert.equal((await unresolved.json()).error.code, 'PROVIDER_UNAVAILABLE');
  assert.equal((await operations(unprovisioned, noProvision.id)).length, 0);

  stage = 'the public API role cannot resolve owners or destinations';
  for (const [name, args] of [
    ['resolve_velo_deposit_owner', { p_deposit: creditA.id }],
    ['resolve_family_parent_destination', { p_family: a.family_id, p_parent: a.user_id }],
  ]) {
    const denied = await service.rpc(name, args);
    assert.equal(denied.error?.code, '42501', `${name} must not be callable by the public service role`);
  }

  assert.equal(serverError, null);
  await new Promise(resolve => server.close(resolve));
  passed = true;
  console.log('PASS: deposit-credit-route (loopback Postgres, real coordinator handler, journal, custody resolver and guarded dispatch; simulated ledger)');
} catch (error) {
  const line = /verify-deposit-credit-route\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  console.error(`FAIL: deposit-credit-route (${stage}; ${error.code ?? error.name}${line ? `; line ${line}` : ''})`);
  if (serverError) console.error(`FAIL: deposit-credit-route (simulated ledger assertion: ${serverError.message})`);
} finally {
  try {
    await new Promise(resolve => ledgerServer ? ledgerServer.close(resolve) : resolve());
    const ids = members.map(member => member.user_id);
    const families = [...new Set(members.map(member => member.family_id))];
    if (ids.length) {
      const secrets = (await pool.query('select vault_secret_id from wallet_custody.family_signing_keys where family_id=any($1::uuid[])', [families]))
        .rows.map(row => row.vault_secret_id);
      await pool.query('delete from wallet_custody.family_signing_keys where family_id=any($1::uuid[])', [families]);
      if (secrets.length) await pool.query('delete from vault.secrets where id=any($1::uuid[])', [secrets]);
      await pool.query('delete from wallet_custody.family_provisions where family_id=any($1::uuid[])', [families]);
      await pool.query('delete from wallet_custody.family_capacity_slots where family_id=any($1::uuid[])', [families]);
      await pool.query('delete from public.velo_topups where parent_id=any($1::uuid[])', [ids]);
      await pool.query('delete from public.family_members where user_id=any($1::uuid[])', [ids]);
      for (const id of ids) assert.equal((await service.auth.admin.deleteUser(id)).error, null);
    }
  } catch {
    passed = false;
    if (members.length) console.error('FAIL: deposit-credit-route (fixture cleanup)');
  } finally { await pool?.end(); }
}
if (!passed) process.exitCode = 1;
