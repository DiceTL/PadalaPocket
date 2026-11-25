import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomBytes, randomUUID } from 'node:crypto';
import pg from 'pg';
import { Keypair, Networks, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { buildDepositCreditTransfer, creditVeloDeposit } from '../src/velo-deposit-credit.mjs';
import { guardedDispatcher } from '../src/money-guarded-dispatch.mjs';
import { assertLoopbackBindings, coordinatorConfiguration } from './local-verification.mjs';

// T15 reserves the T14 receipt in the existing journal, then uses T06 dispatch.
// The ledger is simulated; a passing result is not evidence of a live transfer.
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
    const email = `credit-${randomUUID()}@example.test`;
    const created = await service.auth.admin.createUser({ email, password: password(email), email_confirm: true });
    assert.equal(created.error, null);
    const member = { family_id: randomUUID(), user_id: created.data.user.id, role: 'parent' };
    members.push(member);
    await pool.query("insert into public.family_members(user_id,family_id,role) values($1,$2,'parent')", [member.user_id, member.family_id]);
    return member;
  }

  const [a, b] = await Promise.all([parent(), parent()]);
  const receiver = Keypair.random().publicKey();
  const source = Keypair.random();
  const guard = Keypair.random();
  const parentWallet = Keypair.random();
  const sourceAccount = source.publicKey();
  const parentAccount = parentWallet.publicKey();
  const nowMs = Date.now();
  const now = () => nowMs;
  let sequence = 0, prepares = 0, sends = 0, envelope = null, hash = null;
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
        assert.equal(tx.source, sourceAccount);
        assert.equal(tx.operations.length, 1);
        const [operation] = tx.operations;
        assert.equal(operation.type, 'payment');
        assert.equal(operation.destination, parentAccount);
        assert.equal(operation.asset.isNative(), true);
        assert.equal(operation.amount, '0.0010331');
        assert.equal(tx.signatures.length, 2);
        for (const key of [source, guard]) assert.ok(tx.signatures.some(signature => key.verify(tx.hash(), signature.signature())));
        envelope = tx.toXDR();
        hash = tx.hash().toString('hex');
        sends++;
        res.end(JSON.stringify({
          jsonrpc: '2.0', id: body.id,
          result: { status: 'PENDING', hash, latestLedger: 124, latestLedgerCloseTime: 1 },
        }));
        return;
      }
      assert.equal(body.method, 'getTransaction');
      assert.equal(body.params.hash, hash);
      res.end(JSON.stringify({
        jsonrpc: '2.0', id: body.id,
        result: {
          status: 'SUCCESS', txHash: hash, latestLedger: 124, latestLedgerCloseTime: 1,
          oldestLedger: 1, oldestLedgerCloseTime: 0, ledger: 123, createdAt: 1,
          applicationOrder: 1, feeBump: false, envelopeXdr: envelope, resultXdr,
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
  const resolveDestination = async () => ({ address: parentAccount, network: 'testnet', version: 1 });

  async function makeDeposit({ verified = false, txHash = null } = {}) {
    const row = {
      id: randomUUID(),
      txHash: txHash ?? randomBytes(32).toString('hex'),
      payer: Keypair.random().publicKey(),
      verifiedAt: new Date(nowMs).toISOString(),
      ledger: 5726509,
    };
    await pool.query(`insert into public.velo_topups
      (id,family_id,parent_id,request_key,rules_revision,amount_stroops,expected_receiver,amount_minor,
       mapping_version,status,tx_hash,payer_address,verification_status,verified_at,verified_ledger)
      values($1,$2,$3,$4,0,10331,$5,1000,'php-xlm-20261107-v1','paid',$6,$7,$8,$9,$10)`, [
      row.id, a.family_id, a.user_id, randomUUID(), receiver,
      verified ? row.txHash : null, verified ? row.payer : null, verified ? 'verified' : 'unverified',
      verified ? row.verifiedAt : null, verified ? row.ledger : null,
    ]);
    return row;
  }

  const credit = (deposit, overrides = {}) => creditVeloDeposit(coordinator, {
    depositId: deposit.id, familyId: a.family_id, parentId: a.user_id, sourceAccount,
    resolveDestination, dispatch, prepare, ...overrides,
  });
  const operationCount = async deposit => Number((await pool.query(
    "select count(*) from public.money_operations where family_id=$1 and request_key=$2 and purpose='deposit_credit'",
    [a.family_id, deposit.id],
  )).rows[0].count);
  const dispatchRows = async deposit => (await pool.query(
    `select d.phase,d.source_account,s.transaction_hash from public.money_dispatch_steps d
     join public.money_signed_steps s on s.operation_id=d.operation_id and s.step_key=d.step_key
     where d.operation_id=(select id from public.money_operations where family_id=$1 and request_key=$2)`,
    [a.family_id, deposit.id],
  )).rows;

  stage = 'unverified receipt is refused';
  const unverified = await makeDeposit();
  await assert.rejects(credit(unverified), { code: 'DEPOSIT_NOT_VERIFIED' });
  assert.equal(await operationCount(unverified), 0);
  assert.equal(prepares, 0);
  assert.equal(sends, 0);

  stage = 'verified receipt reserves once and transfers the exact amount';
  const verified = await makeDeposit({ verified: true });
  const forbiddenRead = await service.rpc('read_velo_deposit_receipt', {
    p_deposit: verified.id, p_family: a.family_id, p_parent: a.user_id,
  });
  assert.equal(forbiddenRead.error?.code, '42501');
  const concurrent = await Promise.all(Array.from({ length: 8 }, () => credit(verified)));
  assert.equal(serverError, null);
  assert.equal(await operationCount(verified), 1);
  assert.equal(prepares, 1);
  assert.equal(sends, 1);
  const confirmed = await credit(verified);
  assert.equal(confirmed.confirmed, true);
  assert.equal(confirmed.status, 'confirmed');
  assert.equal(confirmed.transactionHash, hash);
  assert.equal(confirmed.confirmedLedger, '123');
  assert.ok(concurrent.every(result => result.operationId === confirmed.operationId));
  const operations = (await pool.query(
    `select id,actor_id,source_ref,destination_ref,amount_stroops,request_payload
     from public.money_operations where family_id=$1 and request_key=$2`,
    [a.family_id, verified.id],
  )).rows;
  assert.equal(operations.length, 1);
  assert.equal(operations[0].actor_id, a.user_id);
  assert.equal(operations[0].source_ref, `project:${sourceAccount}`);
  assert.equal(operations[0].destination_ref, `family:${a.family_id}:parent`);
  assert.equal(operations[0].amount_stroops, '10331');
  assert.deepEqual(operations[0].request_payload, {
    depositId: verified.id, receiptTxHash: verified.txHash, sourceAccount, destinationAccount: parentAccount,
  });
  const reservations = await pool.query('select state from public.money_reservations where operation_id=$1', [operations[0].id]);
  assert.deepEqual(reservations.rows, [{ state: 'held' }]);
  const dispatched = await dispatchRows(verified);
  assert.deepEqual(dispatched, [{ phase: 'confirmed', source_account: sourceAccount, transaction_hash: hash }]);
  await credit(verified);
  assert.equal(sends, 1);

  stage = 'another family or parent cannot consume the receipt';
  await assert.rejects(credit(verified, { familyId: b.family_id, parentId: b.user_id }), { code: 'NOT_FOUND' });
  await assert.rejects(credit(verified, { parentId: b.user_id }), { code: 'NOT_FOUND' });
  assert.equal(sends, 1);

  stage = 'project source cannot also be the parent destination';
  const wrongDestination = await makeDeposit({ verified: true });
  await assert.rejects(credit(wrongDestination, {
    resolveDestination: async () => ({ address: sourceAccount, network: 'testnet' }),
  }), { code: 'TRANSFER_IDENTITY_MISMATCH' });
  await assert.rejects(credit(wrongDestination, {
    resolveDestination: async () => ({ address: parentAccount, network: 'public' }),
  }), { code: 'INVALID_DESTINATION' });
  assert.equal(await operationCount(wrongDestination), 0);
  assert.equal(sends, 1);

  stage = 'a reused payment hash cannot become another verified receipt';
  const reused = await makeDeposit();
  await assert.rejects(pool.query(
    `update public.velo_topups set tx_hash=$1,payer_address=$2,verification_status='verified',
       verified_at=now(),verified_ledger=5726510 where id=$3`,
    [verified.txHash, Keypair.random().publicKey(), reused.id],
  ), error => error.code === '23505');
  await assert.rejects(credit(reused), { code: 'DEPOSIT_NOT_VERIFIED' });
  assert.equal(await operationCount(reused), 0);
  assert.equal(sends, 1);

  stage = 'unknown transfer is not credit and a retry uses the same reservation';
  const uncertain = await makeDeposit({ verified: true });
  const pending = await credit(uncertain, {
    dispatch: async () => ({ phase: 'dispatching', observation: 'unavailable' }),
  });
  assert.equal(pending.confirmed, false);
  assert.equal(pending.status, 'dispatching');
  assert.equal(pending.transactionHash, null);
  assert.equal(pending.confirmedLedger, null);
  assert.equal(await operationCount(uncertain), 1);
  assert.equal((await dispatchRows(uncertain)).length, 0);
  const resumed = await credit(uncertain);
  assert.equal(resumed.confirmed, true);
  assert.equal(await operationCount(uncertain), 1);
  assert.equal(sends, 2);
  assert.equal((await dispatchRows(uncertain))[0].phase, 'confirmed');

  assert.equal(serverError, null);
  passed = true;
  console.log('PASS: deposit-credit (loopback Postgres, real money journal and coordinated dispatch; simulated ledger)');
} catch (error) {
  const line = /verify-deposit-credit\.mjs:(\d+)/.exec(error.stack ?? '')?.[1];
  console.error(`FAIL: deposit-credit (${stage}; ${error.code ?? error.name}${line ? `; line ${line}` : ''})`);
  if (serverError) console.error(`FAIL: deposit-credit (simulated ledger assertion: ${serverError.message})`);
} finally {
  try {
    await new Promise(resolve => ledgerServer ? ledgerServer.close(resolve) : resolve());
    const ids = members.map(member => member.user_id);
    if (ids.length) {
      await pool.query('delete from public.velo_topups where parent_id=any($1::uuid[])', [ids]);
      await pool.query('delete from public.family_members where user_id=any($1::uuid[])', [ids]);
      for (const id of ids) assert.equal((await service.auth.admin.deleteUser(id)).error, null);
    }
  } catch {
    passed = false;
    if (members.length) console.error('FAIL: deposit-credit (fixture cleanup)');
  } finally { await pool?.end(); }
}
if (!passed) process.exitCode = 1;
