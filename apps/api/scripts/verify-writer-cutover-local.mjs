import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { randomUUID, randomBytes } from 'node:crypto';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder, rpc, xdr } from '@stellar/stellar-sdk';
import { coordinatorConfiguration, assertLoopbackBindings, emails, options } from './local-verification.mjs';
import { admitMoneyOperation, recordMoneySignedStep } from '../src/money-journal.mjs';
import { guardedDispatcher } from '../src/money-guarded-dispatch.mjs';
import { reconcileMoneyStep } from '../src/money-recovery.mjs';
import { createClient } from '@supabase/supabase-js';
import { createMoneyWriters } from '../src/money-writers.mjs';
import { createIsolatedFinancialHandler } from '../src/money-coordinator-handler.mjs';
import { handler as publicHandler } from '../src/router.mjs';
import { dispatchAuthorityBootstrap } from '../src/money-authority-bootstrap.mjs';

// Actual Postgres/SDK/HTTP, but controlled ledger responses; never live settlement evidence.
let server;
const hops = [];
try {
  const { admin, legacy, status, password } = await coordinatorConfiguration();
  assertLoopbackBindings();
  const id = '00000000-0000-4000-8000-000000000008';
  assert.equal((await legacy.from('money_signed_steps').select('signed_envelope').limit(1)).error?.code, '42501');
  const forbiddenCalls = [
    ['admit_money_operation', { p_family: id, p_actor: id, p_request_key: id, p_purpose: 'cutover', p_network: 'testnet', p_asset: 'native', p_source_ref: 'source', p_destination_ref: 'target', p_amount_stroops: '1', p_payload: {} }],
    ['record_money_signed_step', { p_operation: id, p_family: id, p_step_key: 'payment', p_source_account: 'invalid', p_transaction_hash: '0'.repeat(64), p_signed_envelope: 'AAAA' }],
    ['claim_money_dispatch', { p_operation: id, p_family: id, p_step_key: 'payment', p_source: 'invalid', p_claim: id }],
    ['save_money_dispatch', { p_operation: id, p_family: id, p_step_key: 'payment', p_source: 'invalid', p_claim: id, p_hash: '0'.repeat(64), p_signed: 'AAAA' }],
    ['claim_money_dispatch_send', { p_operation: id, p_family: id, p_step_key: 'payment', p_source: 'invalid', p_claim: id }],
    ['confirm_money_dispatch', { p_operation: id, p_family: id, p_step_key: 'payment', p_hash: '0'.repeat(64), p_ledger: '1', p_result_xdr: 'AAAA' }],
    ['read_money_recovery', { p_operation: id, p_family: id, p_step_key: 'payment' }],
  ];
  for (const [name, args] of forbiddenCalls) assert.equal((await legacy.rpc(name, args)).error?.code, '42501');
  const access=await legacy.rpc('read_money_cutover_access');
  assert.equal(access.error,null);assert.equal(access.data.role,'service_role');assert.equal(access.data.readsSigned,false);
  assert.ok(Object.values(access.data.tables).every(rights=>Object.values(rights).every(value=>value===false)));
  for (const rights of Object.values(access.data.tables)) assert.equal(rights.truncate, false);
  assert.ok(Object.values(access.data.rpcs).every(value=>value===false));
  for(const table of ['needs_funding','needs_purchases','weekly_events']){
    assert.equal((await legacy.from(table).update({coordinator_version:8}).is('id',null)).error?.code,'42501');
  }
  const members = await admin.from('family_members').select('user_id,family_id').eq('role', 'parent');
  assert.equal(members.error, null);
  assert.ok(members.data.length);
  const member = members.data[0];
  // Owner-approved: disposable, unfunded, memory-only keys and expired envelopes.
  const source = Keypair.random(), guard = Keypair.random();
  const sourceAccount = source.publicKey();
  const account = { account_id: sourceAccount, thresholds: { low_threshold: 2, med_threshold: 2, high_threshold: 2 },
    signers: [sourceAccount, guard.publicKey()].map(key => ({ key, weight: 1, type: 'ed25519_public_key' })) };
  const operation = async (amountStroops = '1', purpose = 'cutover-verification') => admitMoneyOperation(admin, { member, requestKey: randomUUID(), purpose,
    network: 'testnet', asset: 'native', sourceRef: sourceAccount, destinationRef: 'verification:target', amountStroops, payload: { fixture: true } });
  const setup = await operation('0', 'device_setup');
  assert.equal(setup.amountStroops, '0');
  const setupHold = await admin.from('money_reservations').select('state').eq('operation_id', setup.id).single();
  assert.equal(setupHold.error, null); assert.equal(setupHold.data.state, 'held');
  await assert.rejects(operation('0'), { code: 'INVALID_INPUT' });
  await assert.rejects(operation('1', 'device_setup'), { code: 'INVALID_INPUT' });
  let sequence = 0;
  const prepare = () => {
    const tx = new TransactionBuilder(new Account(sourceAccount, String(sequence++)), { fee: '100', networkPassphrase: Networks.TESTNET,
      timebounds: { minTime: 0, maxTime: 1 } }).addOperation(Operation.payment({ destination: sourceAccount, asset: Asset.native(), amount: '0.0000001' })).build();
    tx.sign(source); return tx.toXDR();
  };
  let envelope, hash, sends = 0, preparations = 0, loseAcknowledgement = true, delayedReads = 0, reads = 0;
  const resultXdr = new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('100'),
    result: xdr.TransactionResultResult.txSuccess([xdr.OperationResult.opInner(xdr.OperationResultTr.payment(xdr.PaymentResult.paymentSuccess()))]),
    ext: new xdr.TransactionResultExt(0) }).toXDR('base64');
  server = createServer(async (req, res) => {
    try {
      let text = ''; for await (const part of req) text += part;
      const body = JSON.parse(text);
      if (body.method === 'sendTransaction') {
        const tx = TransactionBuilder.fromXDR(body.params.transaction, Networks.TESTNET);
        assert.equal(tx.signatures.length, 2);
        for (const key of [source, guard]) assert.ok(tx.signatures.some(signature => key.verify(tx.hash(), signature.signature())));
        envelope = tx.toXDR(); hash = tx.hash().toString('hex'); sends++;
        const stored = await admin.from('money_signed_steps').select('signed_envelope').eq('transaction_hash', hash).single();
        assert.equal(stored.error, null); assert.equal(stored.data.signed_envelope, envelope);
        if (loseAcknowledgement) { req.socket.destroy(); return; } // Received bytes, lost acknowledgement.
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { status: 'PENDING', hash,
          latestLedger: 124, latestLedgerCloseTime: 1 } })); return;
      }
      assert.equal(body.method, 'getTransaction'); assert.equal(body.params.hash, hash);
      res.setHeader('Content-Type', 'application/json');
      reads++;
      if (delayedReads-- > 0) {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { status: 'NOT_FOUND',
          latestLedger: 124, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 0 } })); return;
      }
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { status: 'SUCCESS', txHash: hash,
        latestLedger: 124, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 0,
        ledger: 123, createdAt: 1, applicationOrder: 1, feeBump: false, envelopeXdr: envelope, resultXdr,
        resultMetaXdr: new xdr.TransactionMeta(0, []).toXDR('base64') } }));
    } catch { res.statusCode = 500; res.end('{}'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const ledger = new rpc.Server(`http://127.0.0.1:${server.address().port}`, { allowHttp: true, timeout: 1000 });
  const dispatch = guardedDispatcher({ database: admin, guard, readAccount: async () => account, server: ledger, now: () => 0 });
  const admitted = await operation();
  const input = { operationId: admitted.id, familyId: member.family_id, stepKey: 'payment', sourceAccount };
  await Promise.all(Array.from({ length: 8 }, () => dispatch(input, { prepare: async () => { preparations++; return prepare(); } })));
  assert.equal(preparations, 1); assert.equal(sends, 1);
  const observed = await reconcileMoneyStep(admin, input, { server: ledger });
  assert.equal(observed.outcome, 'confirmed'); assert.equal(observed.transactionHash, hash);
  await dispatch(input, { prepare: async () => { throw Error('REPLACEMENT_FORBIDDEN'); } });
  assert.equal(sends, 1);
  const hold = await admin.from('money_reservations').select('state').eq('operation_id', admitted.id).single();
  assert.equal(hold.error, null); assert.equal(hold.data.state, 'held');
  const historical = await operation(), old = prepare();
  const oldHash = TransactionBuilder.fromXDR(old, Networks.TESTNET).hash().toString('hex');
  await recordMoneySignedStep(admin, { operationId: historical.id, familyId: member.family_id, stepKey: 'payment', sourceAccount,
    transactionHash: oldHash, signedEnvelope: old });
  await assert.rejects(dispatch({ ...input, operationId: historical.id }, { prepare: async () => { throw Error('HISTORICAL_REPLACEMENT'); } }), { code: 'UNCOORDINATED_STEP' });
  assert.equal(sends, 1);
  const retained = await admin.from('money_signed_steps').select('signed_envelope').eq('operation_id', historical.id).single();
  assert.equal(retained.error, null); assert.equal(retained.data.signed_envelope, old);
  const student = await admin.from('family_members').select('user_id').eq('family_id',member.family_id).eq('role','student').single();
  assert.equal(student.error,null);
  const writers = createMoneyWriters({database:admin,guard,readAccount:async()=>account,server:ledger,now:()=>0,
    activatedAt:new Date(Date.now()-60000).toISOString()});
  for(const kind of ['funding','purchase','weekly']){
    const row={id:randomUUID(),family_id:member.family_id,parent_id:member.user_id,student_id:student.data.user_id,
      coordinator_version:8,created_at:new Date().toISOString(),amount_stroops:'1',total_stroops:'1',needs_stroops:'1',wants_stroops:'0'};
    const state=await writers.dispatch({kind,row,stage:'payment',sourceAccount,prepare:async()=>({signed:prepare()})});
    assert.equal(state.phase,'dispatching');assert.equal('signedEnvelope' in state,false);
    const observed=await writers.observe({kind,row,stage:'payment'});assert.equal(observed.outcome,'confirmed');
    const stored=await admin.from('money_operations').select('actor_id,amount_stroops,purpose').eq('id',observed.operationId).single();
    assert.equal(stored.error,null);assert.equal(stored.data.purpose,kind);assert.equal(stored.data.amount_stroops,1);
    assert.equal(stored.data.actor_id,kind==='purchase'?student.data.user_id:member.user_id);
  }
  // Ordinary ledger latency must finish the stage before the next source sequence is prepared.
  loseAcknowledgement = false;
  const delayedRow = { id: randomUUID(), family_id: member.family_id, parent_id: member.user_id,
    coordinator_version: 8, created_at: new Date().toISOString(), amount_stroops: '1', total_stroops: '1' };
  const beforeDelayed = sends, beforeReads = reads;
  for (const stage of ['device', 'fund']) {
    delayedReads = 2;
    const state = await writers.dispatch({ kind: 'funding', row: delayedRow, stage, sourceAccount,
      prepare: async () => ({ signed: prepare() }) });
    assert.equal(state.phase, 'confirmed');
    assert.equal('signedEnvelope' in state, false);
  }
  assert.equal(sends, beforeDelayed + 2); assert.equal(reads, beforeReads + 6);
  const historicalRow={id:randomUUID(),coordinator_version:0,family_id:member.family_id,parent_id:member.user_id,created_at:new Date().toISOString(),amount_stroops:'1'};
  const beforeHistory=sends;
  await assert.rejects(writers.dispatch({kind:'funding',row:historicalRow,stage:'fund',sourceAccount,prepare:async()=>{throw Error('HISTORICAL_REPLACEMENT');}}),{code:'UNCOORDINATED_STEP'});
  assert.equal((await writers.observe({kind:'funding',row:historicalRow,stage:'fund'})).outcome,'fenced');assert.equal(sends,beforeHistory);
  const unguarded=await operation(), signed=prepare(), claim=randomUUID();
  const identity={p_operation:unguarded.id,p_family:member.family_id,p_step_key:'payment',p_source:sourceAccount,p_claim:claim};
  assert.equal((await admin.rpc('claim_money_dispatch',identity)).error,null);
  assert.equal((await admin.rpc('save_money_dispatch',{...identity,p_signed:signed,p_hash:TransactionBuilder.fromXDR(signed,Networks.TESTNET).hash().toString('hex')})).error,null);
  await assert.rejects(dispatch({...input,operationId:unguarded.id},{prepare:async()=>{throw Error('RESIGN_FORBIDDEN');}}),{code:'SIGNING_IDENTITY_MISMATCH'});
  const fenced=await admin.rpc('read_money_recovery',{p_operation:unguarded.id,p_family:member.family_id,p_step_key:'payment'});
  assert.equal(fenced.error,null);assert.equal(fenced.data.phase,'prepared');assert.equal(fenced.data.reservationState,'held');assert.equal(sends,beforeHistory);
  // Exercise the actual proxy/private HTTP surface with real local Auth; no provider dispatch.
  const accessToken=randomBytes(32).toString('hex');
  process.env.SUPABASE_URL=status.API_URL;process.env.SUPABASE_PUBLISHABLE_KEY=status.ANON_KEY;delete process.env.SUPABASE_SECRET_KEY;
  const isolated=createServer(createIsolatedFinancialHandler({writers,database:admin,token:accessToken}));hops.push(isolated);
  isolated.listen(0,'127.0.0.1');await once(isolated,'listening');
  const origin=`http://127.0.0.1:${isolated.address().port}`;
  assert.equal((await fetch(origin+'/api/purchases')).status,403);
  assert.equal((await fetch(origin+'/api/purchases',{headers:{'x-money-coordinator-token':accessToken}})).status,401);
  process.env.NODE_ENV='test';process.env.MONEY_COORDINATOR_URL=origin;process.env.MONEY_COORDINATOR_ACCESS_TOKEN=accessToken;
  const gateway=createServer(publicHandler);hops.push(gateway);gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  const publicOrigin=`http://127.0.0.1:${gateway.address().port}`;
  assert.equal((await fetch(publicOrigin+'/api/purchases')).status,401);
  const auth=createClient(status.API_URL,status.ANON_KEY,options);
  const login=await auth.auth.signInWithPassword({email:emails[0],password:password(emails[0])});assert.equal(login.error,null);
  assert.equal((await auth.rpc('read_money_cutover_access')).error?.code,'42501');
  assert.equal((await createClient(status.API_URL,status.ANON_KEY,options).rpc('read_money_cutover_access')).error?.code,'42501');
  const readiness=await admin.from('family_members').select('wallet_ready').eq('user_id',login.data.user.id).single();assert.equal(readiness.error,null);
  const response=await fetch(publicOrigin+'/api/purchases',{headers:{authorization:`Bearer ${login.data.session.access_token}`,'x-money-coordinator-token':'untrusted'}});
  assert.equal(response.status,readiness.data.wallet_ready===false?409:200);
  const body=await response.text();assert.equal(body.includes(accessToken),false);
  assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(sends,beforeHistory);
  // Bootstrap has its own project sequence, even while an original source remains fenced.
  const originalSnapshot = signer => ({ account_id: signer.publicKey(), sequence: '800', subentry_count: 0,
    num_sponsoring: 0, num_sponsored: 0, balances: [{ asset_type: 'native', balance: '100.0000000', selling_liabilities: '0.0000000' }],
    signers: [{ key: signer.publicKey(), weight: 1, type: 'ed25519_public_key' }],
    thresholds: { low_threshold: 0, med_threshold: 0, high_threshold: 0 } });
  const feeSigner = Keypair.random();
  const bootstrapInput = { member, requestKey: randomUUID(), feeSource: { signer: feeSigner, account: originalSnapshot(feeSigner) },
    targets: ['OWNER', 'AGENT', 'MERCHANT', 'STUDENT'].map((role, index) => {
      const signer = index === 0 ? source : Keypair.random(); return { role, signer, account: originalSnapshot(signer) };
    }), guardAccount: guard.publicKey(), baseReserveStroops: '5000000', baseFeeStroops: '100',
    maxReserveStroops: '20000000', maxFeeStroops: '800' };
  let bootstrapSends = 0, bootstrapEnvelope, bootstrapHash;
  const bootstrapLedger = createServer(async (req, res) => {
    try {
      let raw = ''; for await (const chunk of req) raw += chunk;
      const request = JSON.parse(raw);
      if (request.method === 'sendTransaction') {
        const tx = TransactionBuilder.fromXDR(request.params.transaction, Networks.TESTNET);
        assert.equal(tx.source, feeSigner.publicKey()); assert.equal(tx.sequence, '801'); assert.equal(tx.timeBounds.maxTime, '120');
        assert.equal(tx.signatures.length, 5); assert.equal(tx.operations.length, 8);
        for (const signer of [feeSigner, ...bootstrapInput.targets.map(target => target.signer)]) {
          assert.ok(tx.signatures.some(signature => signer.verify(tx.hash(), signature.signature())));
        }
        bootstrapEnvelope = tx.toXDR(); bootstrapHash = tx.hash().toString('hex'); bootstrapSends++;
        const saved = await admin.from('money_signed_steps').select('signed_envelope').eq('transaction_hash', bootstrapHash).single();
        assert.equal(saved.error, null); assert.equal(saved.data.signed_envelope, bootstrapEnvelope);
        req.socket.destroy(); return;
      }
      assert.equal(request.method, 'getTransaction'); assert.equal(request.params.hash, bootstrapHash);
      const results = bootstrapInput.targets.flatMap(() => [
        xdr.OperationResult.opInner(xdr.OperationResultTr.payment(xdr.PaymentResult.paymentSuccess())),
        xdr.OperationResult.opInner(xdr.OperationResultTr.setOptions(xdr.SetOptionsResult.setOptionsSuccess())),
      ]);
      const result = new xdr.TransactionResult({ feeCharged: xdr.Int64.fromString('800'),
        result: xdr.TransactionResultResult.txSuccess(results), ext: new xdr.TransactionResultExt(0) });
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ jsonrpc: '2.0', id: request.id, result: { status: 'SUCCESS', txHash: bootstrapHash,
        latestLedger: 124, latestLedgerCloseTime: 1, oldestLedger: 1, oldestLedgerCloseTime: 0,
        ledger: 123, createdAt: 1, applicationOrder: 1, feeBump: false, envelopeXdr: bootstrapEnvelope,
        resultXdr: result.toXDR('base64'), resultMetaXdr: new xdr.TransactionMeta(0, []).toXDR('base64') } }));
    } catch { res.statusCode = 500; res.end('{}'); }
  });
  hops.push(bootstrapLedger); bootstrapLedger.listen(0, '127.0.0.1'); await once(bootstrapLedger, 'listening');
  const bootstrapTransport = new rpc.Server(`http://127.0.0.1:${bootstrapLedger.address().port}`, { allowHttp: true, timeout: 1000 });
  const bootstrap = () => dispatchAuthorityBootstrap(admin, bootstrapInput, { server: bootstrapTransport, now: () => 0 });
  const contenders = await Promise.all(Array.from({ length: 8 }, bootstrap));
  assert.equal(bootstrapSends, 1);
  const bootstrapOperation = contenders[0].operationId;
  assert.ok(contenders.every(state => state.operationId === bootstrapOperation && !('signedEnvelope' in state)));
  assert.equal((await reconcileMoneyStep(admin, { operationId: bootstrapOperation, familyId: member.family_id,
    stepKey: 'authority_cutover' }, { server: bootstrapTransport })).outcome, 'confirmed');
  assert.equal((await bootstrap()).phase, 'confirmed'); assert.equal(bootstrapSends, 1);
  await assert.rejects(dispatchAuthorityBootstrap(admin, { ...bootstrapInput, maxFeeStroops: '801' },
    { server: bootstrapTransport, now: () => 0 }), { code: 'IDEMPOTENCY_CONFLICT' });
  const afterBootstrap = await admin.rpc('read_money_recovery', { p_operation: unguarded.id, p_family: member.family_id, p_step_key: 'payment' });
  assert.equal(afterBootstrap.error, null); assert.deepEqual(afterBootstrap.data, fenced.data);
  const bootstrapHold = await admin.from('money_reservations').select('state').eq('operation_id', bootstrapOperation).single();
  assert.equal(bootstrapHold.error, null); assert.equal(bootstrapHold.data.state, 'held');
  const bootstrapAmount = await admin.from('money_operations').select('amount_stroops,source_ref,request_payload').eq('id', bootstrapOperation).single();
  assert.equal(bootstrapAmount.error, null); assert.equal(String(bootstrapAmount.data.amount_stroops), '20000000');
  assert.equal(bootstrapAmount.data.source_ref, `project:${feeSigner.publicKey()}`);
  assert.equal(bootstrapAmount.data.request_payload.funding, 'project_operating');
  console.log('PASS: writer-cutover-local');
} catch {
  console.error('FAIL: writer-cutover-local'); process.exitCode = 1;
} finally {
  for(const hop of hops){hop.closeAllConnections();await new Promise(resolve=>hop.close(resolve));}
  if (server) { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
}
