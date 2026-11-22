import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fork } from 'node:child_process';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder, xdr } from '@stellar/stellar-sdk';
import { createClient } from '@supabase/supabase-js';
import { admitMoneyOperation } from '../src/money-journal.mjs';
import { coordinatorConfiguration as localConfiguration, assertLoopbackBindings, options, emails } from './local-verification.mjs';

// Real Postgres/process coordination; the loopback ledger is explicitly not live settlement proof.
let step = 'local-configuration';
const children = new Set();
const resources = new Map();
const observations = new Map();
let server;
let fixture;
let admin;
let parent;
let other;
function resource() {
  const key = Keypair.random(); // Owner-approved: memory only, unfunded, never serialized.
  const value = { key, source: key.publicKey(), prepares: 0, sends: 0, sequence: 0, response: 'success' };
  resources.set(value.source, value);
  return value;
}
function worker(input, settings = {}) {
  const child = fork(new URL('./dispatch-verification-worker.mjs', import.meta.url), [], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env: process.env });
  children.add(child);
  let pausedResolve;
  let finishResolve;
  const paused = new Promise(resolve => { pausedResolve = resolve; });
  const result = new Promise(resolve => { finishResolve = resolve; });
  child.on('message', message => {
    if (message.event === 'paused') pausedResolve();
    else { pausedResolve(); finishResolve(message); }
  });
  child.on('exit', () => { children.delete(child); pausedResolve(); finishResolve({ event: 'exit' }); });
  child.send({ input, fixture, ...settings });
  return { child, paused, result, resume: () => child.send({ event: 'resume' }) };
}
async function run(input, settings) {
  const result = await worker(input, settings).result;
  assert.equal(result.event, 'result');
  return result.value;
}
async function operation(source, member = parent) {
  const op = await admitMoneyOperation(admin, {
    member, requestKey: randomUUID(), purpose: 'dispatch-verification', network: 'testnet', asset: 'native',
    sourceRef: source, destinationRef: 'verification:destination', amountStroops: '1', payload: { fixture: true },
  });
  return { operationId: op.id, familyId: member.family_id, stepKey: 'payment', sourceAccount: source };
}
async function sourceOwner(source) {
  const result = await admin.from('money_dispatch_sources').select('operation_id,step_key').eq('source_account', source).single();
  assert.equal(result.error, null);
  return result.data.operation_id;
}
const args = input => ({ p_operation: input.operationId, p_family: input.familyId, p_step_key: input.stepKey, p_source: input.sourceAccount, p_claim: randomUUID() });
function resultXdr(success = true, mode) {
  return new xdr.TransactionResult({
    feeCharged: xdr.Int64.fromString('100'),
    result: success ? xdr.TransactionResultResult.txSuccess(mode === 'empty-success' ? [] : [
      xdr.OperationResult.opInner(xdr.OperationResultTr.payment(mode === 'failed-operation' ? xdr.PaymentResult.paymentUnderfunded() : xdr.PaymentResult.paymentSuccess())),
    ]) : xdr.TransactionResultResult.txFailed([]),
    ext: new xdr.TransactionResultExt(0),
  }).toXDR('base64');
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
        assert.ok(item);
        item.prepares++;
        let signedEnvelope = 'not XDR';
        if (body.mode !== 'malformed') {
          const signer = body.mode === 'wrong-source' ? Keypair.random() : item.key;
          const tx = new TransactionBuilder(new Account(item.source, String(item.sequence++)), {
            fee: '100', networkPassphrase: body.mode === 'wrong-network' ? 'T06 deliberately incorrect test domain' : Networks.TESTNET,
            timebounds: { minTime: 0, maxTime: 1 },
          }).addOperation(Operation.payment({ destination: item.source, asset: Asset.native(), amount: '0.0000001' })).build();
          tx.sign(signer);
          signedEnvelope = tx.toXDR();
        }
        res.end(JSON.stringify({ signedEnvelope }));
        return;
      }
      assert.equal(req.url, '/rpc');
      let result;
      if (body.method === 'sendTransaction') {
        const tx = TransactionBuilder.fromXDR(body.params.transaction, Networks.TESTNET);
        const item = resources.get(tx.source);
        assert.ok(item);
        assert.equal(tx.timeBounds.maxTime, '1'); // Expired in the real world; never submit to Testnet.
        const hash = tx.hash().toString('hex');
        const stored = await admin.from('money_signed_steps').select('signed_envelope').eq('transaction_hash', hash).single();
        assert.equal(stored.error, null);
        assert.equal(stored.data.signed_envelope, body.params.transaction);
        item.sends++;
        observations.set(hash, { item, envelope: body.params.transaction, result: resultXdr(), ledger: 123 });
        if (item.response === 'disconnect') { req.socket.destroy(); return; }
        result = { status: 'PENDING', hash, latestLedger: 122, latestLedgerCloseTime: 1 };
      } else {
        assert.equal(body.method, 'getTransaction');
        const observation = observations.get(body.params.hash);
        const missing = !observation || ['missing', 'disconnect'].includes(observation.item.response);
        result = { status: missing ? 'NOT_FOUND' : 'SUCCESS', txHash: body.params.hash,
          latestLedger: 124, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 0 };
        let envelope = observation?.envelope;
        if (!missing && observation.item.response === 'wrong-hash') {
          envelope = [...observations.values()].find(value => value.envelope !== envelope).envelope;
        } else if (!missing && observation.item.response === 'wrong-envelope') {
          const altered = TransactionBuilder.fromXDR(envelope, Networks.TESTNET);
          altered.signatures.push(altered.signatures[0]);
          envelope = altered.toXDR(); // Same transaction hash, different exact signed bytes.
        }
        if (!missing) Object.assign(result, {
          txHash: observation.item.response === 'wrong-hash' ? 'f'.repeat(64) : body.params.hash,
          ledger: observation.ledger, createdAt: 1, applicationOrder: 1, feeBump: false,
          envelopeXdr: envelope,
          resultXdr: observation.item.response === 'failed-result' ? resultXdr(false) : resultXdr(true,observation.item.response),
          resultMetaXdr: new xdr.TransactionMeta(0, []).toXDR('base64'),
        });
      }
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result }));
    } catch {
      res.statusCode = 500;
      res.end('{}');
    }
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  fixture = `http://127.0.0.1:${server.address().port}`;
}
async function verify() {
  const configuration = await localConfiguration();
  ({ admin } = configuration);
  assertLoopbackBindings();
  const membership = await admin.from('family_members').select('user_id,family_id,role').eq('role', 'parent');
  assert.equal(membership.error, null);
  parent = membership.data.find(row => row.family_id === '00000000-0000-4000-8000-000000000001');
  other = membership.data.find(row => row.family_id === '00000000-0000-4000-8000-000000000002');
  assert.ok(parent && other);
  step = 'durable-source-claim';
  const preflight = await operation(resource().source);
  const claimed = await admin.rpc('claim_money_dispatch', args(preflight));
  assert.equal(claimed.error, null); // Red before the T06 migration, before importing the new coordinator.
  assert.equal(claimed.data.canPrepare, true);
  await startFixture();

  step = 'paused-preparer-and-shared-source';
  const shared = resource();
  const first = await operation(shared.source);
  const competing = await operation(shared.source, other);
  const paused = worker(first, { pause: 'claimed' });
  await paused.paused;
  const duplicates = await Promise.all([run(first), run(first), run(competing)]);
  assert.deepEqual(duplicates.map(value => value.phase), ['preparing', 'preparing', 'busy']);
  assert.equal(shared.prepares, 0);
  assert.equal(shared.sends, 0);
  assert.equal(await sourceOwner(shared.source), first.operationId);
  paused.resume();
  assert.equal((await paused.result).value.phase, 'confirmed');
  assert.equal(shared.prepares, 1);
  assert.equal(shared.sends, 1);

  step = 'saved-checkpoint-resume-and-stale-worker';
  const savedResource = resource();
  const savedInput = await operation(savedResource.source);
  const savedWorker = worker(savedInput, { pause: 'saved' });
  await savedWorker.paused;
  assert.equal(savedResource.prepares, 1);
  assert.equal(savedResource.sends, 0);
  const resumed = await run(savedInput);
  assert.equal(resumed.phase, 'confirmed');
  savedWorker.resume();
  assert.equal((await savedWorker.result).value.phase, 'confirmed');
  assert.equal(savedResource.prepares, 1);
  assert.equal(savedResource.sends, 1);
  assert.equal((await run(savedInput)).transactionHash, resumed.transactionHash);
  const nextInput = await operation(savedResource.source);
  const nextWorker = worker(nextInput, { pause: 'claimed' });
  await nextWorker.paused;
  const observed = observations.get(resumed.transactionHash);
  const replay = await admin.rpc('confirm_money_dispatch', {
    p_operation: savedInput.operationId, p_family: savedInput.familyId, p_step_key: savedInput.stepKey,
    p_hash: resumed.transactionHash, p_ledger: String(observed.ledger), p_result_xdr: observed.result,
  });
  assert.equal(replay.error, null);
  assert.equal(await sourceOwner(savedResource.source), nextInput.operationId);
  assert.equal((await run(savedInput)).phase, 'confirmed');
  assert.equal(await sourceOwner(savedResource.source), nextInput.operationId);
  nextWorker.resume();
  assert.equal((await nextWorker.result).value.phase, 'confirmed');

  step = 'paused-send-owner';
  const sending = resource();
  const sendingInput = await operation(sending.source);
  const sendingWorker = worker(sendingInput, { pause: 'send' });
  await sendingWorker.paused;
  assert.equal((await run(sendingInput)).phase, 'dispatching');
  assert.equal((await run(await operation(sending.source))).phase, 'busy');
  assert.equal(sending.prepares, 1);
  assert.equal(sending.sends, 0);
  sendingWorker.resume();
  assert.equal((await sendingWorker.result).value.phase, 'confirmed');
  assert.equal(sending.sends, 1);

  step = 'crashed-preparation-stays-fenced';
  const abandoned = resource();
  const abandonedInput = await operation(abandoned.source);
  const dead = worker(abandonedInput, { pause: 'claimed' });
  await dead.paused;
  dead.child.kill();
  await once(dead.child, 'exit');
  assert.equal((await run(abandonedInput)).phase, 'preparing');
  assert.equal(abandoned.prepares, 0);
  assert.equal(abandoned.sends, 0);

  step = 'uncertain-send-never-replaced';
  const uncertain = resource();
  uncertain.response = 'disconnect';
  const uncertainInput = await operation(uncertain.source);
  assert.equal((await run(uncertainInput)).phase, 'dispatching');
  assert.equal((await run(uncertainInput)).phase, 'dispatching');
  assert.equal((await run(await operation(uncertain.source))).phase, 'busy');
  assert.equal(uncertain.prepares, 1);
  assert.equal(uncertain.sends, 1);
  uncertain.response = 'success';
  assert.equal((await run(uncertainInput)).phase, 'confirmed');
  assert.equal(uncertain.sends, 1);

  step = 'invalid-confirmation-stays-fenced';
  for (const response of ['wrong-hash', 'wrong-envelope', 'failed-result', 'empty-success', 'failed-operation']) {
    step = `invalid-confirmation-${response}`;
    const item = resource();
    item.response = response;
    const input = await operation(item.source);
    assert.equal((await run(input)).phase, 'dispatching');
    assert.equal((await run(input)).phase, 'dispatching');
    assert.equal(await sourceOwner(item.source), input.operationId);
    assert.equal(item.sends, 1);
  }

  step = 'invalid-signatures-and-expiry-never-send';
  for (const settings of [{ mode: 'wrong-source' }, { mode: 'wrong-network' }, { mode: 'malformed' }, { realClock: true }]) {
    const item = resource();
    const input = await operation(item.source);
    const invalid = await worker(input, settings).result;
    assert.equal(invalid.event, 'error');
    assert.equal(invalid.code, 'INVALID_SIGNED_TRANSACTION');
    assert.equal(item.sends, 0);
    assert.equal((await run(input)).phase, 'preparing');
    assert.equal(item.prepares, 1);
  }

  step = 'family-source-and-owner-binding';
  const identityArgs = args(abandonedInput);
  assert.equal((await admin.rpc('claim_money_dispatch', { ...identityArgs, p_family: other.family_id })).error?.message, 'FORBIDDEN');
  assert.equal((await admin.rpc('claim_money_dispatch', { ...identityArgs, p_source: shared.source })).error?.message, 'DISPATCH_IDENTITY_CONFLICT');
  assert.equal((await admin.rpc('save_money_dispatch', { ...identityArgs, p_signed: 'AAAA', p_hash: '1'.repeat(64) })).error?.message, 'STALE_WORKER');

  step = 'browser-and-direct-write-denial';
  const anonymous = createClient(configuration.status.API_URL, configuration.status.ANON_KEY, options);
  const browser = createClient(configuration.status.API_URL, configuration.status.ANON_KEY, options);
  assert.equal((await browser.auth.signInWithPassword({ email: emails[0], password: configuration.password(emails[0]) })).error, null);
  for (const client of [anonymous, browser]) {
    for (const table of ['money_dispatch_steps', 'money_dispatch_sources']) assert.ok((await client.from(table).select('*').limit(1)).error);
    assert.ok((await client.rpc('claim_money_dispatch', identityArgs)).error);
    assert.ok((await client.rpc('claim_money_dispatch_send', identityArgs)).error);
    assert.ok((await client.rpc('save_money_dispatch', { ...identityArgs, p_signed: 'AAAA', p_hash: '1'.repeat(64) })).error);
    assert.ok((await client.rpc('confirm_money_dispatch', { p_operation: abandonedInput.operationId, p_family: parent.family_id, p_step_key: 'payment', p_hash: '1'.repeat(64), p_ledger: '1', p_result_xdr: 'AAAA' })).error);
  }
  assert.ok((await admin.from('money_dispatch_steps').update({ phase: 'confirmed' }).eq('operation_id', abandonedInput.operationId)).error);
  assert.ok((await admin.from('money_dispatch_sources').update({ operation_id: null }).eq('source_account', abandoned.source)).error);
}
const deadline = setTimeout(() => { for (const child of children) child.kill(); }, 180000);
try {
  await verify();
  console.log('PASS: dispatch-boundary');
} catch {
  console.error(`FAIL: dispatch-boundary (${step})`);
  process.exitCode = 1;
} finally {
  clearTimeout(deadline);
  for (const child of children) child.kill();
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
