import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import pg from 'pg';
import { Keypair, rpc } from '@stellar/stellar-sdk';
import { Velo } from '@carts1024/velo-sdk';
import { veloTopups } from '../src/velo-topups.mjs';
import { buildDepositCreditTransfer, creditVeloDeposit } from '../src/velo-deposit-credit.mjs';
import { guardedDispatcher } from '../src/money-guarded-dispatch.mjs';
import { HORIZON_TESTNET, xlmToStroops } from '../src/velo-receipts.mjs';
import { assertLoopbackBindings, coordinatorConfiguration } from './local-verification.mjs';

// DEC-136 live proof, steps P3/P4. Real Velo paid intents, one real Testnet
// credit for C through T06 dispatch, then T16 reconciliation for D. Checkouts are
// sequential, so each intent window holds exactly one candidate payment.
// `observe` only rereads saved state and hashes; no mode saves or repeats a send.
const STATE = new URL('../../../.env.t14-t17-live.json', import.meta.url);
const HORIZON = HORIZON_TESTNET;
const hashPattern = /^[a-f0-9]{64}$/;
const modes = ['verify', 'verify-late', 'observe'];
const mode = process.argv[2];
let stage = 'arguments', passed = false, pool, service, coordinator, summary = {};
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

async function horizon(path) {
  const response = await fetch(`${HORIZON}${path}`, { redirect: 'error', signal: AbortSignal.timeout(15000) });
  assert.equal(response.ok, true, `horizon read ${path}`);
  return response.json();
}
const nativeStroops = body => xlmToStroops(body.balances.find(balance => balance.asset_type === 'native').balance);
const balanceOf = async address => nativeStroops(await horizon(`/accounts/${address}`));

try {
  assert.ok(modes.includes(mode), `usage: live-deposit-verify.mjs ${modes.join('|')}`);
  let state;
  try {
    state = JSON.parse(await readFile(STATE, 'utf8'));
  } catch {
    throw Object.assign(Error('live state file missing; run live-deposit-checkout.mjs prepare first'), { code: 'STATE_MISSING' });
  }
  assert.equal(state.decision, 'DEC-136');
  assert.equal(state.network, 'testnet');

  stage = 'local-database';
  assertLoopbackBindings();
  const local = await coordinatorConfiguration();
  service = local.legacy;
  coordinator = local.admin;
  pool = new pg.Pool({ connectionString: local.status.DB_URL, connectionTimeoutMillis: 5000, statement_timeout: 15000 });

  stage = 'configuration';
  const receiver = Keypair.fromSecret(process.env.OWNER_SECRET).publicKey();
  assert.equal(receiver, state.owner.receiver, 'project receiver changed since prepare');
  const operator = Keypair.fromPublicKey(state.operator).publicKey();
  assert.notEqual(operator, receiver);
  const velo = new Velo({ apiKey: process.env.VELO_API_KEY, baseUrl: 'https://www.velo-build.dev', environment: 'testnet', timeoutMs: 15000, maxRetries: 0 });
  const request = async member => {
    const res = { setHeader() {}, end(raw) { this.body = JSON.parse(raw); } };
    await veloTopups({ method: 'GET', headers: {} }, res, {
      authenticate: async () => ({ member }), database: () => service, receiver: () => receiver,
      provider: () => velo, operator: () => operator, horizon: fetch,
    });
    return res;
  };
  const memberOf = entry => ({ family_id: entry.familyId, user_id: entry.parentId, role: 'parent' });
  const readDeposit = async entry => {
    const response = await request(memberOf(entry));
    assert.equal(response.statusCode, 200, `GET failed ${response.statusCode} ${JSON.stringify(response.body)}`);
    const row = response.body.topups.find(item => item.id === entry.depositId);
    assert.ok(row, `deposit ${entry.depositId} missing from GET`);
    return { row, body: response.body };
  };
  const storedRow = async entry => (await pool.query(
    'select payer_address,tx_hash,verification_status,verified_ledger,amount_stroops from public.velo_topups where id=$1',
    [entry.depositId],
  )).rows[0];
  const operationsFor = async (entry, purpose = 'deposit_credit') => (await pool.query(
    `select id,amount_stroops,source_ref,destination_ref,request_payload
     from public.money_operations where family_id=$1 and request_key=$2 and purpose=$3`,
    [entry.familyId, entry.depositId, purpose],
  )).rows;

  const tooling = () => {
    const source = Keypair.fromSecret(state.t15.sourceSecret);
    const guard = Keypair.fromSecret(state.t15.guardSecret);
    const server = new rpc.Server('https://soroban-testnet.stellar.org', { timeout: 15000 });
    const dispatch = guardedDispatcher({
      database: coordinator, guard, server,
      readAccount: async address => horizon(`/accounts/${address}`),
    });
    const prepare = async context => {
      const current = await horizon(`/accounts/${context.sourceAccount}`);
      return buildDepositCreditTransfer({ ...context, sequence: current.sequence, signer: source });
    };
    const credit = entry => creditVeloDeposit(coordinator, {
      depositId: entry.depositId, familyId: entry.familyId, parentId: entry.parentId,
      sourceAccount: source.publicKey(),
      resolveDestination: async () => ({ address: state.t15.destination, network: 'testnet' }),
      dispatch, prepare,
    });
    return { source, credit };
  };
  const transferEvidence = async (hash, expectedStroops) => {
    const transfer = await horizon(`/transactions/${hash}`);
    assert.equal(transfer.successful, true);
    assert.equal(transfer.hash, hash);
    assert.equal(transfer.source_account, operator);
    const operations = await horizon(`/transactions/${hash}/operations`);
    const payments = operations._embedded.records.filter(record => record.type === 'payment');
    assert.equal(payments.length, 1);
    assert.equal(payments[0].from, operator);
    assert.equal(payments[0].to, receiver);
    assert.equal(payments[0].asset_type, 'native');
    assert.equal(xlmToStroops(payments[0].amount), BigInt(expectedStroops));
    return { ledger: String(transfer.ledger), hash };
  };

  if (mode === 'observe') {
    const observed = {};
    for (const key of ['c', 'd']) {
      if (!state[key]) continue;
      const { row } = await readDeposit(state[key]);
      observed[key] = {
        status: row.status, verificationStatus: row.verificationStatus, cancellationState: row.cancellationState ?? null,
        spendable: row.spendable ?? false, txHash: row.txHash ?? null, creditTxHash: row.creditTxHash ?? null,
      };
    }
    summary = { mode, decision: state.decision, network: 'testnet', observed };
    passed = true;
    console.log('PASS: live-deposit observe (read-only; saved deposits and hashes)');
    console.log(JSON.stringify(summary, null, 2));
  } else if (mode === 'verify') {
    stage = 'checkout c receipt';
    assert.ok(state.c, 'state file has no checkout C');
    const { row: c, body } = await readDeposit(state.c);
    assert.equal(c.status, 'paid', `deposit C intent is ${c.status}`);
    assert.equal(c.verificationStatus, 'verified');
    assert.match(c.txHash ?? '', hashPattern);
    assert.ok(Number(c.verifiedLedger) > 0);
    assert.equal(c.amountMinor, state.amount.minor);
    assert.equal(c.amountXlm, state.amount.xlm);
    assert.equal(c.expectedReceiver, receiver);
    assert.ok(['awaiting_credit', 'confirmed'].includes(c.creditStatus), `unexpected credit status ${c.creditStatus}`);
    const storedC = await storedRow(state.c);
    assert.equal(storedC.verification_status, 'verified');
    assert.equal(storedC.tx_hash, c.txHash);
    assert.equal(storedC.payer_address, operator);
    const receipt = await transferEvidence(c.txHash, storedC.amount_stroops);
    assert.equal(receipt.ledger, c.verifiedLedger);

    stage = 'credit admission';
    const { source, credit } = tooling();
    let confirmed = await credit(state.c);
    for (let attempt = 0; attempt < 3 && !confirmed.confirmed; attempt++) {
      await sleep(4000);
      confirmed = await credit(state.c);
    }
    assert.equal(confirmed.confirmed, true, `credit is ${confirmed.status}`);
    assert.match(confirmed.transactionHash ?? '', hashPattern);
    assert.ok(Number(confirmed.confirmedLedger) > 0);
    const creditHash = confirmed.transactionHash;

    stage = 'credit replay and concurrency';
    const concurrent = await Promise.all(Array.from({ length: 6 }, () => credit(state.c)));
    for (const result of concurrent) assert.equal(result.operationId, confirmed.operationId);
    const replayed = await credit(state.c);
    assert.equal(replayed.operationId, confirmed.operationId);
    assert.equal(replayed.transactionHash, creditHash);
    const operations = await operationsFor(state.c);
    assert.equal(operations.length, 1);
    assert.equal(operations[0].amount_stroops, state.amount.stroops);
    assert.equal(operations[0].source_ref, `project:${source.publicKey()}`);
    assert.equal(operations[0].destination_ref, `family:${state.c.familyId}:parent`);
    assert.equal(operations[0].request_payload.depositId, state.c.depositId);
    assert.equal(operations[0].request_payload.receiptTxHash, c.txHash);
    const steps = (await pool.query(
      `select d.phase,s.transaction_hash from public.money_dispatch_steps d
       join public.money_signed_steps s on s.operation_id=d.operation_id and s.step_key=d.step_key
       where d.operation_id=$1 and d.step_key='credit'`,
      [operations[0].id],
    )).rows;
    assert.deepEqual(steps, [{ phase: 'confirmed', transaction_hash: creditHash }]);
    assert.equal((await pool.query('select count(*)::int as n from public.money_signed_steps where operation_id=$1',
      [operations[0].id])).rows[0].n, 1, 'a replay must not save a second envelope');

    stage = 'real credit transfer';
    const transfer = await horizon(`/transactions/${creditHash}`);
    assert.equal(transfer.successful, true);
    assert.equal(transfer.source_account, source.publicKey());
    assert.equal(String(transfer.ledger), confirmed.confirmedLedger);
    const creditOperations = await horizon(`/transactions/${creditHash}/operations`);
    const creditPayments = creditOperations._embedded.records.filter(record => record.type === 'payment');
    assert.equal(creditPayments.length, 1);
    assert.equal(creditPayments[0].from, source.publicKey());
    assert.equal(creditPayments[0].to, state.t15.destination);
    assert.equal(xlmToStroops(creditPayments[0].amount), BigInt(state.amount.stroops));

    stage = 'destination received the credit once';
    const inbound = (await horizon(`/accounts/${state.t15.destination}/payments?order=desc&limit=50`))
      ._embedded.records.filter(record => record.type === 'payment' && record.asset_type === 'native'
        && record.from === source.publicKey() && record.to === state.t15.destination);
    assert.equal(inbound.length, 1, 'destination must receive exactly one credit payment');
    assert.equal(xlmToStroops(inbound[0].amount), BigInt(state.amount.stroops));
    assert.equal(inbound[0].transaction_hash, creditHash);
    assert.ok(await balanceOf(state.t15.destination) >= BigInt(state.amount.stroops));

    stage = 't17 projection';
    const balanced = await readDeposit(state.c);
    const credited = balanced.row;
    const balance = balanced.body.parentBalance;
    assert.equal(balance.basis, 'confirmed_journal');
    assert.equal(balance.confirmedDepositStroops, state.amount.stroops);
    assert.equal(balance.pendingDepositStroops, '0');
    assert.equal(balance.confirmedAllocationStroops, '0');
    assert.equal(balance.pendingAllocationStroops, '0');
    assert.equal(balance.confirmedHoldingsStroops, state.amount.stroops);
    assert.equal(balance.availableStroops, state.amount.stroops);
    assert.equal(credited.status, 'paid');
    assert.equal(credited.creditStatus, 'confirmed');
    assert.equal(credited.spendable, true);
    assert.equal(credited.creditTxHash, creditHash);
    assert.equal(credited.creditLedger, String(confirmed.confirmedLedger));

    stage = 'reconcile deposit b';
    let late = null;
    if (state.b) {
      const b = await readDeposit(state.b);
      late = {
        status: b.row.status, cancellationState: b.row.cancellationState, verificationStatus: b.row.verificationStatus,
        creditStatus: b.row.creditStatus, spendable: b.row.spendable ?? false, txHash: b.row.txHash ?? null,
      };
      assert.equal(late.status, 'cancelled');
      assert.equal(late.cancellationState, 'late_paid');
      assert.equal(b.row.checkoutUrl, null);
      assert.notEqual(late.spendable, true);
      assert.equal(late.creditStatus, 'cancelled');
      assert.equal((await operationsFor(state.b)).length, 0);
      const unverified = await storedRow(state.b);
      assert.equal(unverified.tx_hash, null, 'a fenced deposit must not store an ambiguous payment as verified');
    }

    summary = {
      mode, decision: state.decision, network: 'testnet',
      checkoutC: {
        depositId: state.c.depositId, amountStroops: state.amount.stroops, amountXlm: state.amount.xlm,
        receiptTxHash: c.txHash, receiptLedger: c.verifiedLedger, payer: operator, receiver,
      },
      credit: {
        operationId: operations[0].id, transactionHash: creditHash, ledger: String(confirmed.confirmedLedger),
        source: source.publicKey(), destination: state.t15.destination, amountStroops: state.amount.stroops,
        workflow: 'T05 journal + T06 guarded dispatch',
      },
      projection: balance,
      depositB: late,
    };
    passed = true;
    console.log('PASS: live-deposit verify (real Velo receipt C, real Testnet credit, T17 projection, B reconciled)');
    console.log(JSON.stringify(summary, null, 2));
  } else {
    stage = 'checkout d receipt';
    assert.ok(state.d, 'state file has no checkout D');
    const { row: d } = await readDeposit(state.d);
    // DEC-140: a verified late payment supersedes the failed cancellation.
    assert.equal(d.status, 'paid');
    assert.equal(d.cancellationState, 'superseded');
    assert.equal(d.checkoutUrl, null);
    assert.equal(d.verificationStatus, 'verified');
    assert.match(d.txHash ?? '', hashPattern);
    assert.notEqual(d.txHash, state.c?.depositId ? (await storedRow(state.c)).tx_hash : null);
    assert.ok(Number(d.verifiedLedger) > 0);
    assert.equal(d.spendable, false, 'a superseded receipt is not spendable before its credit confirms');
    assert.equal(d.creditStatus, 'awaiting_credit');
    assert.equal((await operationsFor(state.d)).length, 0);
    const storedD = await storedRow(state.d);
    assert.equal(storedD.verification_status, 'verified');
    assert.equal(storedD.tx_hash, d.txHash);
    assert.equal(storedD.payer_address, operator);
    const receipt = await transferEvidence(d.txHash, storedD.amount_stroops);
    assert.equal(receipt.ledger, d.verifiedLedger);

    stage = 'superseded deposit awaits a separately approved credit';
    // No send here: the local deposit-cancel check proves the exactly-once credit
    // and replay. A live credit for D needs its own operation approval.
    assert.equal((await operationsFor(state.d)).length, 0);
    assert.equal((await pool.query(
      "select count(*)::int as n from public.money_dispatch_steps d join public.money_operations o on o.id=d.operation_id where o.family_id=$1",
      [state.d.familyId],
    )).rows[0].n, 0);

    summary = {
      mode, decision: state.decision, network: 'testnet',
      checkoutD: {
        depositId: state.d.depositId, amountXlm: state.amount.xlm, paymentTxHash: d.txHash,
        paymentLedger: d.verifiedLedger, status: d.status, cancellationState: d.cancellationState,
        spendable: d.spendable, creditStatus: d.creditStatus, creditOperationCount: 0,
      },
    };
    passed = true;
    console.log('PASS: live-deposit verify-late (verified late payment supersedes cancellation; no credit sent)');
    console.log(JSON.stringify(summary, null, 2));
  }
} catch (error) {
  console.error(`FAIL: live-deposit ${mode ?? '(no mode)'} (${stage}; ${error.code ?? error.message})`);
  if (error.code === 'ERR_ASSERTION') console.error(String(error.message).slice(0, 400));
} finally { await pool?.end(); }
if (!passed) process.exitCode = 1;
