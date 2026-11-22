import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { createClient } from '@supabase/supabase-js';
import { admitMoneyOperation } from '../src/money-journal.mjs';
import { coordinatorConfiguration as localConfiguration, assertLoopbackBindings, emails, options } from './local-verification.mjs';

// Approved offline fixture: keys in memory, expired envelopes, controlled loopback RPC only.
let step = 'local-configuration';
let admin, parent, other, fixture, server, reconcile, observer;
let reads = 0;
const children = new Set();
const resources = new Map();
const known = new Map();
function resource() {
  const key = Keypair.random();
  const item = { key, source: key.publicKey(), prepares: 0, sends: 0, mode: 'missing' };
  resources.set(item.source, item);
  return item;
}
async function operation(source = `verification:${randomUUID()}`) {
  const result = await admitMoneyOperation(admin, { member: parent, requestKey: randomUUID(), purpose: 'recovery-verification',
    network: 'testnet', asset: 'native', sourceRef: source, destinationRef: 'verification:destination', amountStroops: '1', payload: { fixture: true } });
  return { operationId: result.id, familyId: parent.family_id, stepKey: 'payment', sourceAccount: source };
}
const readArgs = input => ({ p_operation: input.operationId, p_family: input.familyId, p_step_key: input.stepKey });
function child(script, input, settings = {}) {
  const process = fork(new URL(script, import.meta.url), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'] });
  children.add(process);
  let finish, paused;
  const result = new Promise(resolve => { finish = resolve; });
  const ready = new Promise(resolve => { paused = resolve; });
  process.on('message', message => { if (message.event === 'paused') paused(); else { paused(); finish(message); } });
  process.on('exit', () => { children.delete(process); paused(); finish({ event: 'exit' }); });
  process.send({ input, fixture, ...settings });
  return { process, result, ready };
}
async function interrupted(input, pause) {
  const worker = child('./dispatch-verification-worker.mjs', input, { pause });
  await worker.ready;
  assert.equal(worker.process.connected, true);
  worker.process.kill();
  await once(worker.process, 'exit');
}
async function recovery(input, settings) {
  const result = await child('./recovery-verification-worker.mjs', input, settings).result;
  assert.equal(result.event, 'result');
  assert.equal('signedEnvelope' in result.value, false);
  return result.value;
}
async function unchanged(input, expectedOwner = input.operationId) {
  const hold = await admin.from('money_reservations').select('state').eq('operation_id', input.operationId).single();
  assert.equal(hold.error, null);
  assert.equal(hold.data.state, 'held');
  const source = await admin.from('money_dispatch_sources').select('operation_id').eq('source_account', input.sourceAccount).single();
  assert.equal(source.error, null);
  assert.equal(source.data.operation_id, expectedOwner);
}
function successResult(mode) {
  const results = mode === 'empty-success' ? [] : [xdr.OperationResult.opInner(xdr.OperationResultTr.payment(
    mode === 'failed-inner' ? xdr.PaymentResult.paymentUnderfunded() : xdr.PaymentResult.paymentSuccess(),
  ))];
  return new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('100'),
    result: mode === 'failed' ? xdr.TransactionResultResult.txFailed(results) : xdr.TransactionResultResult.txSuccess(results),
    ext: new xdr.TransactionResultExt(0) }).toXDR('base64');
}
async function startFixture() {
  server = createServer(async (req, res) => {
    try {
      let text = '';
      for await (const chunk of req) text += chunk;
      const body = JSON.parse(text);
      res.setHeader('Content-Type', 'application/json');
      if (req.url === '/prepare') {
        const item = resources.get(body.sourceAccount);
        item.prepares++;
        const tx = new TransactionBuilder(new Account(item.source, '0'), { fee: '100', networkPassphrase: Networks.TESTNET,
          timebounds: { minTime: 0, maxTime: 1 } }).addOperation(Operation.payment({ destination: item.source, asset: Asset.native(), amount: '0.0000001' })).build();
        tx.sign(item.key);
        item.envelope = tx.toXDR();
        item.hash = tx.hash().toString('hex');
        known.set(item.hash, item);
        res.end(JSON.stringify({ signedEnvelope: item.envelope }));
        return;
      }
      assert.equal(req.url, '/rpc');
      if (body.method === 'sendTransaction') {
        const tx = TransactionBuilder.fromXDR(body.params.transaction, Networks.TESTNET);
        const item = known.get(tx.hash().toString('hex'));
        assert.ok(item);
        assert.equal(tx.timeBounds.maxTime, '1');
        item.sends++;
        req.socket.destroy(); // Bytes received, acknowledgement lost, worker exits without confirming.
        return;
      }
      assert.equal(body.method, 'getTransaction');
      reads++;
      const item = known.get(body.params.hash);
      assert.ok(item);
      if (item.mode === 'error') { res.statusCode = 503; res.end('{}'); return; }
      if (item.mode === 'malformed') { res.end('not JSON'); return; }
      const result = { status: item.mode === 'missing' ? 'NOT_FOUND' : item.mode === 'failed' ? 'FAILED' : 'SUCCESS',
        txHash: body.params.hash, latestLedger: 124, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 0 };
      if (result.status !== 'NOT_FOUND') {
        let envelope = item.envelope;
        if (item.mode === 'wrong-envelope') envelope = [...known.values()].find(value => value !== item).envelope;
        if (item.mode === 'changed-signatures') {
          const tx = TransactionBuilder.fromXDR(envelope, Networks.TESTNET);
          tx.signatures.push(tx.signatures[0]);
          envelope = tx.toXDR();
        }
        Object.assign(result, { ledger: item.mode === 'no-ledger' ? 0 : 123, createdAt: 1, applicationOrder: 1, feeBump: false,
          envelopeXdr: envelope, resultXdr: successResult(item.mode), resultMetaXdr: new xdr.TransactionMeta(0, []).toXDR('base64') });
      }
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    } catch { res.statusCode = 500; res.end('{}'); }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  fixture = `http://127.0.0.1:${server.address().port}`;
  observer = new rpc.Server(`${fixture}/rpc`, { allowHttp: true, timeout: 1000 });
}
async function verify() {
  const configuration = await localConfiguration();
  ({ admin } = configuration);
  assertLoopbackBindings();
  const members = await admin.from('family_members').select('user_id,family_id,role').eq('role', 'parent');
  assert.equal(members.error, null);
  parent = members.data.find(row => row.family_id === '00000000-0000-4000-8000-000000000001');
  other = members.data.find(row => row.family_id === '00000000-0000-4000-8000-000000000002');
  assert.ok(parent && other);
  step = 'read-only-recovery-snapshot';
  const initial = await operation();
  const snapshot = await admin.rpc('read_money_recovery', readArgs(initial));
  assert.equal(snapshot.error, null); // Red before the migration; no absent-module import masks it.
  assert.equal(snapshot.data.phase, 'unstarted');
  ({ reconcileMoneyStep: reconcile } = await import('../src/money-recovery.mjs'));
  await startFixture();
  assert.equal((await reconcile(admin, initial, { server: observer })).reason, 'NO_DISPATCH_RECORD');
  assert.equal(reads, 0);
  const noClaim = await admin.from('money_dispatch_steps').select('*').eq('operation_id', initial.operationId);
  assert.equal(noClaim.error, null);
  assert.deepEqual(noClaim.data, []);

  step = 'interrupted-preparation-and-pre-send';
  for (const [pause, reason] of [['claimed', 'PREPARATION_UNRESOLVED'], ['saved', 'NOT_DISPATCHED'], ['send', 'TRANSACTION_NOT_FOUND']]) {
    const item = resource();
    const input = await operation(item.source);
    await interrupted(input, pause);
    const result = await recovery(input);
    assert.equal(result.outcome, 'fenced');
    assert.equal(result.reason, reason);
    assert.equal(item.sends, 0);
    await unchanged(input);
  }

  step = 'unknown-outcomes-preserve-reservations';
  const item = resource();
  const input = await operation(item.source);
  const sent = await child('./dispatch-verification-worker.mjs', input).result;
  assert.equal(sent.event, 'result');
  assert.equal(sent.value.phase, 'dispatching');
  assert.equal(item.prepares, 1);
  assert.equal(item.sends, 1);
  for (const mode of ['missing', 'error', 'malformed', 'failed', 'wrong-envelope', 'changed-signatures', 'empty-success', 'failed-inner', 'no-ledger']) {
    step = `uncertain-${mode}`;
    item.mode = mode;
    const result = await reconcile(admin, input, { server: observer });
    assert.equal(result.outcome, 'fenced');
    assert.equal(result.phase, 'dispatching');
    assert.equal(JSON.stringify(result).includes(item.envelope), false);
    assert.equal(item.prepares, 1);
    assert.equal(item.sends, 1);
    await unchanged(input);
  }

  step = 'concurrent-exact-success';
  item.mode = 'success';
  const results = await Promise.all([recovery(input), recovery(input), ...Array.from({ length: 6 }, () => reconcile(admin, input, { server: observer }))]);
  for (const result of results) {
    assert.equal(result.outcome, 'confirmed');
    assert.equal(result.transactionHash, item.hash);
    assert.equal(result.confirmedLedger, '123');
  }
  assert.equal(item.prepares, 1);
  assert.equal(item.sends, 1);
  await unchanged(input, null);
  const checkpoints = await admin.from('money_dispatch_steps').select('phase,confirmed_ledger,confirmed_result_xdr').eq('operation_id', input.operationId);
  assert.equal(checkpoints.error, null);
  assert.equal(checkpoints.data.length, 1);
  assert.equal(checkpoints.data[0].phase, 'confirmed');

  step = 'retained-checkpoint-does-not-release-new-owner';
  const next = await operation(item.source);
  assert.equal((await admin.rpc('claim_money_dispatch', { ...readArgs(next), p_source: item.source, p_claim: randomUUID() })).error, null);
  item.mode = 'missing';
  const before = reads;
  assert.equal((await recovery(input)).outcome, 'confirmed');
  assert.equal(reads, before);
  await unchanged(next);

  step = 'lost-checkpoint-response';
  const lostItem = resource();
  const lostInput = await operation(lostItem.source);
  assert.equal((await child('./dispatch-verification-worker.mjs', lostInput).result).event, 'result');
  lostItem.mode = 'success';
  const lost = await child('./recovery-verification-worker.mjs', lostInput, { loseCheckpointResponse: true }).result;
  assert.equal(lost.event, 'error');
  assert.equal(lost.code, 'PROVIDER_UNAVAILABLE');
  lostItem.mode = 'missing';
  assert.equal((await recovery(lostInput)).outcome, 'confirmed');
  assert.equal(lostItem.sends, 1);
  await unchanged(lostInput, null);

  step = 'unmanaged-steps-and-family-access';
  const legacy = await admin.rpc('record_money_signed_step', { ...readArgs(initial), p_source_account: item.source,
    p_transaction_hash: createHash('sha256').update(randomUUID()).digest('hex'), p_signed_envelope: 'AAAA' });
  assert.equal(legacy.error, null);
  assert.equal((await reconcile(admin, initial, { server: observer })).reason, 'UNCOORDINATED_STEP');
  await assert.rejects(reconcile(admin, { ...input, familyId: other.family_id }, { server: observer }), { code: 'FORBIDDEN' });
  await assert.rejects(reconcile(admin, { ...input, operationId: randomUUID() }, { server: observer }), { code: 'FORBIDDEN' });
  const anonymous = createClient(configuration.status.API_URL, configuration.status.ANON_KEY, options);
  assert.ok((await anonymous.rpc('read_money_recovery', readArgs(input))).error);
  const browser = createClient(configuration.status.API_URL, configuration.status.ANON_KEY, options);
  assert.equal((await browser.auth.signInWithPassword({ email: emails[0], password: configuration.password(emails[0]) })).error, null);
  assert.ok((await browser.rpc('read_money_recovery', readArgs(input))).error);
}
const deadline = setTimeout(() => { for (const process of children) process.kill(); }, 120000);
try { await verify(); console.log('PASS: recovery-boundary'); }
catch { console.error(`FAIL: recovery-boundary (${step})`); process.exitCode = 1; }
finally {
  clearTimeout(deadline);
  for (const process of children) process.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
