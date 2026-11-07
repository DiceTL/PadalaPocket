import { test } from 'node:test';
import { DEFAULT_SETTINGS } from '../src/family.mjs';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { purchases } from '../src/purchases.mjs';
import { validatePhoto } from '../src/purchase-providers.mjs';
const student = '9e078e6c-7041-4756-97a3-671df6f201e8';
const id = 'ad10cf07-4824-4990-bc51-bde5e7334faf';
const key = '8de9b1e9-bb2b-4f7d-886e-86f588b769f6';
const payload = { sellerId: 'demo-seller', priceMinor: '242', mime: 'image/png', photoBase64: Buffer.from('synthetic-photo').toString('base64') };
function fixture({ role = 'student', ai = { productName: 'Notebook', category: 'school_supplies', uncertain: false, prohibited: false }, funds = true, status = 'SUCCESS', rows = [] } = {}) {
  const calls = { ai: 0, submit: [], prepare: [], db: 0 }; let nonce = 0;
  // Seeded rows have the same non-null defaults as the hosted schema.
  for (const row of rows) { row.claim_started ??= false; row.reserved ??= false; }
  function table() {
    let filters = [], mutation, insert, single = false;
    const run = async () => {
      let selected = rows.filter(row => filters.every(([field, value]) => row[field] === value));
      if (insert) {
        if (rows.some(row => row.request_key === insert.request_key || !['blocked','claimed','failed'].includes(row.status))) return { error: { code: '23505' } };
        const row = { exception_started:false,exception_stage:0,created_at:new Date().toISOString(), id, status: 'assessing', steps: {}, evidence: {}, claim_started: false, reserved: false, nonce: ++nonce, ...insert }; rows.push(row); selected = [row];
      }
      if (mutation) for (const row of selected) Object.assign(row, structuredClone(mutation));
      // PostgREST serializes every result, including insert/update responses.
      return { data: structuredClone(single ? selected[0] ?? null : selected) };
    };
    const q = { select() { return this; }, eq(k,v) { filters.push([k,v]); return this; }, order: run, maybeSingle() { single = true; return run(); }, single() { single = true; return run(); }, update(patch) { mutation = patch; return this; }, insert(row) { insert = row; return this; }, then(resolve,reject) { return run().then(resolve,reject); } }; return q;
  }
  const db = { from(name) { calls.db++; if (name === 'needs_funding') return { select() { return this; }, eq() { return this; }, then(resolve) { return Promise.resolve({ data: [{ amount_stroops: '10000000', wants_stroops: '8000000' }] }).then(resolve); } }; return table(); }, rpc: async (name, args={}) => {
    if(name==='expire_purchase_reviews')return {data:null};
    const {p_id}=args;
    if(name==='admit_purchase_exception'){
      const row=rows.find(r=>r.id===p_id);
      const admitted=['approved','exception_pending'].includes(row.status) && !row.exception_started && row.exception_stage<7;
      if(admitted)row.exception_started=true;
      return {data:{row:structuredClone(row),admitted}};
    }
    if(name==='decide_purchase_review'){
      const row=rows.find(r=>r.id===p_id);
      if(row.parent_decision)return row.parent_decision.decision===args.p_decision?{data:{row:structuredClone(row),admitted:false}}:{data:{error:'DECISION_ALREADY_CLOSED'}};
      Object.assign(row,{status:args.p_decision==='approve'?'approved':'rejected',reserved:args.p_decision==='approve',parent_decision:{decision:args.p_decision,parentId:args.p_parent,binding:args.p_binding,decidedAt:new Date().toISOString()}});
      return {data:{row:structuredClone(row),admitted:args.p_decision==='approve'}};
    }
    if(name==='begin_purchase_review'){const row=rows.find(r=>r.id===p_id);Object.assign(row,{status:'awaiting_parent',approval_binding:args.p_binding,approval_deadline:new Date(Date.now()+600000).toISOString(),reason:args.p_reason});return {data:structuredClone(row)};}

    const row = rows.find(r => r.id === p_id);
    Object.assign(row, funds ? { status: 'reserved', reserved: true } : { status: 'blocked', reason: 'INSUFFICIENT_FUNDS' }); return { data: funds };
  } };
  let pending = 0n;
  const ledger = { consent:()=>({signature:'test'}),exceptionReady:async()=>true,exceptionComplete:async()=>true,merchantPublicKey: 'fixed-merchant', status: async () => ({ status }), escrow: async () => 10000000n, pending: async () => pending, check: async () => ({ ok: true }), prepare: async stage => { calls.prepare.push(stage); return { signed: `${stage}-envelope`, hash: `${stage}-hash` }; }, submit: async signed => { assert.ok(rows[0].steps[calls.prepare.at(-1)]); calls.submit.push(signed); if(signed==='exception_authorize-envelope')pending=BigInt(rows[0].amount_stroops); if(signed==='exception_claim-envelope')pending=0n; if (signed === 'authorize-envelope') pending = 2500000n; if (signed === 'claim-envelope') pending = 0n; } };
  const deps = { loadRules: async () => ({ revision: 0, settings: structuredClone(DEFAULT_SETTINGS) }), authenticate: async () => ({ member: { role, user_id: student, family_id: 'family' } }), database: () => db, validate: async () => {}, identify: async () => { calls.ai++; return { ai, usage: { total_tokens: 1 } }; }, ledger: () => ledger };
  const request = async (method = 'POST', body = payload, url = '/api/purchases', requestKey = key) => { const res = { setHeader() {}, end(raw) { this.body = Buffer.isBuffer(raw) ? raw : JSON.parse(raw); } }; await purchases({ method, url, body, headers: { 'idempotency-key': requestKey } }, res, deps); return res; };
  return { calls, rows, deps, request, ledger, setStatus(value) { status = value; } };
}
test('unauthenticated purchase fails before privileged access', async () => {
  const f = fixture(); delete f.deps.authenticate;
  const res = await f.request(); assert.equal(res.statusCode, 401); assert.equal(f.calls.db, 0);
});
test('parent cannot submit a purchase', async () => { const f = fixture({ role: 'parent' }); assert.equal((await f.request()).statusCode, 403); assert.equal(f.calls.db, 0); });
test('new purchases enforce persisted category/cap rules, not fixture defaults', async () => {
  const f = fixture(); f.deps.loadRules = async () => ({ revision: 2, settings: { ...DEFAULT_SETTINGS, capMinor: '100', needsCategories: ['school_supplies'] } });
  const result = await f.request(); assert.equal(result.body.reason, 'CAP_EXCEEDED'); assert.equal(f.calls.submit.length, 0); assert.equal(f.rows[0].rules.version, 'family-v1-2');
});
for (const [name, ai, reason] of [
  ['uncertain', { productName: null, category: 'unknown', uncertain: true }, 'AI_UNCERTAIN'],
  ['category', { productName: 'Toy', category: 'toys_collectibles', uncertain: false }, 'CATEGORY_DISALLOWED'],
  ['prohibited', { productName: 'Alcohol', category: 'drinks', uncertain: false, prohibited: true }, 'CATEGORY_DISALLOWED'],
]) test(`${name} blocks without preparing or submitting`, async () => { const f = fixture({ ai }); const res = await f.request(); assert.equal(res.body.reason, reason); assert.equal(res.body.status, reason==='AI_UNCERTAIN'?'blocked':'awaiting_parent'); assert.equal(f.calls.prepare.length, 0); });
test('cap and insufficient funds blocks never dispatch', async () => {
  for (const [options, price, reason] of [[{}, '485', 'CAP_EXCEEDED'], [{ funds: false }, '242', 'INSUFFICIENT_FUNDS']]) {
    const f = fixture(options); const res = await f.request('POST', { ...payload, priceMinor: price }); assert.equal(res.body.reason, reason); assert.equal(f.calls.submit.length, 0);
  }
});
test('allowed purchase persists envelopes before each dispatch and confirms merchant claim', async () => {
  const f = fixture(); const res = await f.request(); assert.equal(res.body.status, 'claimed');
  assert.deepEqual(f.calls.prepare, ['policy','authorize','claim']); assert.equal(f.calls.submit.length, 3);
  assert.equal(res.body.transactions.claim.hash, 'claim-hash'); assert.equal(res.body.photo_base64, undefined); assert.equal(JSON.stringify(res.body).includes('envelope'), false);
  assert.equal(f.rows[0].status, 'claimed'); assert.equal(f.rows[0].evidence.claimLedgerStatus, 'SUCCESS');
});
test('same-key concurrent submissions and later replay do not call AI or pay twice', async () => {
  const f = fixture(); await Promise.all([f.request(),f.request()]); const again = await f.request();
  assert.equal(f.rows.length, 1); assert.equal(f.calls.ai, 1); assert.equal(f.calls.submit.length, 3); assert.equal(again.body.id, id);
  assert.equal((await f.request('POST', { ...payload, priceMinor: '243' })).statusCode, 409);
});
test('private photo requires owning student or linked parent family', async () => {
  const f = fixture(); await f.request();
  assert.ok(Buffer.isBuffer((await f.request('GET', undefined, `/api/purchases/${id}/photo`)).body));
  f.deps.authenticate = async () => ({ member: { role: 'student', user_id: 'other', family_id: 'family' } });
  assert.equal((await f.request('GET', undefined, `/api/purchases/${id}/photo`)).statusCode, 404);
  f.deps.authenticate = async () => ({ member: { role: 'parent', family_id: 'other' } });
  assert.equal((await f.request('GET', undefined, `/api/purchases/${id}/photo`)).statusCode, 404);
});
test('unknown authorization read reconciles exact hash without replacement or claim dispatch', async () => {
  const row = { id, family_id: 'family', student_id: student, status: 'unknown', reason: 'OPERATION_PENDING', steps: { authorize: { hash: 'saved-authorization', signed: 'saved-envelope' } }, evidence: {}, amount_stroops: '2500000' };
  const f = fixture({ rows: [row], status: 'NOT_FOUND' }); const observed = [];
  f.ledger.status = async hash => { observed.push(hash); return { status: observed.length === 1 ? 'NOT_FOUND' : 'SUCCESS' }; };
  assert.equal((await f.request('GET')).body.purchases[0].status, 'unknown');
  assert.equal((await f.request('GET')).body.purchases[0].status, 'merchant_pending');
  assert.equal(row.reason, null); assert.deepEqual(observed, ['saved-authorization','saved-authorization']); assert.equal(f.calls.prepare.length, 0); assert.equal(f.calls.submit.length, 0);
});
test('unknown claim later confirms without resubmission', async () => {
  const row = { id, family_id: 'family', student_id: student, status: 'unknown', steps: { claim: { hash: 'saved-claim' } }, evidence: {}, amount_stroops: '2500000' };
  const f = fixture({ rows: [row] }); assert.equal((await f.request('GET')).body.purchases[0].status, 'claimed'); assert.equal(f.calls.submit.length, 0);
});
test('stale authorization reconciliation cannot overwrite a newer confirmed claim', async () => {
  const row = { id, family_id: 'family', student_id: student, status: 'merchant_pending', claim_started: false, steps: { authorize: { hash: 'saved-auth' } }, evidence: {}, amount_stroops: '2500000', reserved: true };
  const f = fixture({ rows: [structuredClone(row)] });
  f.ledger.status = async hash => {
    assert.equal(hash, 'saved-auth');
    // Another request admits, saves and confirms a claim after the stale read.
    Object.assign(f.rows[0], { status: 'claimed', claim_started: true,
      steps: { ...f.rows[0].steps, claim: { hash: 'saved-claim', signed: 'saved-claim-envelope' } },
      evidence: { claimLedgerStatus: 'SUCCESS', merchantPendingStroops: '0' } });
    return { status: 'SUCCESS' };
  };
  const result = await f.request('GET');
  assert.equal(result.body.purchases[0].status, 'claimed');
  assert.deepEqual(f.rows[0].evidence, { claimLedgerStatus: 'SUCCESS', merchantPendingStroops: '0' });
  assert.equal(f.rows[0].steps.claim.hash, 'saved-claim');
  assert.equal(result.body.purchases[0].transactions.claim.hash, 'saved-claim');
});
test('malformed JSON is rejected as invalid input', async () => {
  const f = fixture();
  const result = await f.request('POST', '{');
  assert.equal(result.statusCode, 400);
  assert.equal(result.body.error.code, 'INVALID_INPUT');
});
test('actual decoder refuses forged or corrupt photos', async () => {
  await assert.rejects(validatePhoto(Buffer.from('not an image'), 'image/png'));
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: '#fff' } }).png().toBuffer();
  await validatePhoto(png, 'image/png'); await assert.rejects(validatePhoto(png, 'image/jpeg'));
});
test('AI outage blocks without reservation or payment and replay never re-assesses', async () => {
  const f = fixture(); let calls = 0;
  f.deps.identify = async () => { calls++; throw Object.assign(Error('unavailable'), { aiDiagnostic: { httpStatus: 429 } }); };
  const first = await f.request(); assert.equal(first.body.status, 'blocked'); assert.equal(first.body.reason, 'AI_UNAVAILABLE');
  await f.request(); assert.equal(calls, 1); assert.equal(f.calls.submit.length, 0); assert.equal(f.rows[0].reserved, false);
});
test('legacy AI-only failed assessment can become blocked without touching a money reservation', async () => {
  const row = { id, student_id: student, family_id: 'family', status: 'unknown', reason: 'AI_UNAVAILABLE', reserved: false, ai: null, steps: {}, amount_stroops: '2500000' };
  const f = fixture({ rows: [row] }); assert.equal((await f.request('GET')).body.purchases[0].status, 'blocked');
  assert.equal(row.reserved, false); assert.equal(f.calls.submit.length, 0);
  row.status = 'unknown'; row.reserved = true;
  assert.equal((await f.request('GET')).body.purchases[0].status, 'unknown');
});
test('explicit concurrent claim admissions dispatch only one saved claim', async () => {
  const row = { id, family_id: 'family', student_id: student, status: 'merchant_pending', claim_started: false, steps: { authorize: { hash: 'saved-auth' } }, evidence: {}, amount_stroops: '2500000', reserved: true };
  const f = fixture({ rows: [row] });
  f.ledger.pending = async () => f.calls.submit.includes('claim-envelope') ? 0n : 2500000n;
  await Promise.all([f.request('POST', {}, `/api/purchases/${id}/claim`), f.request('POST', {}, `/api/purchases/${id}/claim`)]);
  assert.equal(f.calls.prepare.filter(stage => stage === 'claim').length, 1);
  assert.equal(f.calls.submit.filter(signed => signed === 'claim-envelope').length, 1);
});
test('available Needs subtracts retained reservations and claimed debits', async () => {
  const f = fixture(); await f.request();
  assert.equal((await f.request('GET')).body.availableNeedsStroops, '7500000');
});
test('status GET during admitted claim preparation cannot move the purchase backward', async () => {
  const row = {
    id, family_id: 'family', student_id: student, status: 'merchant_pending',
    claim_started: false, reserved: true, amount_stroops: '2500000',
    steps: { authorize: { hash: 'saved-auth', signed: 'saved-auth-envelope' } },
    evidence: { merchant: 'fixed-merchant', authorizationLedgerStatus: 'SUCCESS' },
  };
  const f = fixture({ rows: [row] });
  const savedAuthorization = structuredClone(row.steps.authorize);
  f.ledger.pending = async () => f.calls.submit.includes('claim-envelope') ? 0n : 2500000n;
  let signalPreparationStarted, resumePreparation;
  const preparationStarted = new Promise(resolve => { signalPreparationStarted = resolve; });
  const preparationAllowed = new Promise(resolve => { resumePreparation = resolve; });
  const prepare = f.ledger.prepare;
  f.ledger.prepare = async (stage, purchase, device) => {
    assert.equal(stage, 'claim');
    signalPreparationStarted();
    await preparationAllowed;
    return prepare(stage, purchase, device);
  };
  const ledgerReads = [];
  f.ledger.status = async hash => { ledgerReads.push(hash); return { status: 'SUCCESS' }; };
  const claiming = f.request('POST', {}, `/api/purchases/${id}/claim`);
  await preparationStarted;
  assert.equal(f.rows[0].status, 'claim_pending');
  assert.equal(f.rows[0].claim_started, true);
  assert.equal(f.rows[0].steps.claim, undefined);
  let history;
  let duringPreparation;
  try {
    history = await f.request('GET');
    duringPreparation = structuredClone(f.rows[0]);
  } finally { resumePreparation(); }
  const claimed = await claiming;
  assert.equal(history.body.purchases[0].status, 'claim_pending');
  assert.equal(duringPreparation.status, 'claim_pending');
  assert.equal(duringPreparation.claim_started, true);
  assert.equal(duringPreparation.steps.claim, undefined);
  assert.equal(duringPreparation.reserved, true);
  assert.equal(duringPreparation.evidence.authorizationLedgerStatus, 'SUCCESS');
  assert.equal(f.rows[0].status, 'claimed');
  assert.equal(claimed.body.status, 'claimed');
  assert.equal(f.rows[0].steps.claim.hash, 'claim-hash');
  assert.equal(f.rows[0].steps.claim.signed, 'claim-envelope');
  assert.deepEqual(f.rows[0].steps.authorize, savedAuthorization);
  assert.equal(f.rows[0].evidence.claimLedgerStatus, 'SUCCESS');
  assert.equal(f.rows[0].evidence.merchantPendingStroops, '0');
  assert.equal(f.rows[0].claim_started, true);
  assert.equal(f.calls.prepare.filter(stage => stage === 'claim').length, 1);
  assert.equal(f.calls.submit.filter(signed => signed === 'claim-envelope').length, 1);
  assert.equal(ledgerReads.filter(hash => hash === 'saved-auth').length, 1);
  // Replaying a confirmed claim cannot prepare or submit another transaction.
  const replayed = await f.request('POST', {}, `/api/purchases/${id}/claim`);
  assert.equal(replayed.body.status, 'claimed');
  assert.equal(f.calls.submit.filter(signed => signed === 'claim-envelope').length, 1);
});
test('admitted claim with no saved envelope stays locked when its outcome is uncertain', async () => {
  const row = {
    id, family_id: 'family', student_id: student, status: 'unknown', reason: 'OPERATION_PENDING',
    claim_started: true, reserved: true, amount_stroops: '2500000',
    steps: { authorize: { hash: 'saved-auth', signed: 'saved-auth-envelope' } }, evidence: {},
  };
  const f = fixture({ rows: [row] });
  const snapshot = structuredClone(row);
  let statusReads = 0;
  f.ledger.status = async () => { statusReads++; return { status: 'SUCCESS' }; };
  assert.equal((await f.request('GET')).body.purchases[0].status, 'unknown');
  assert.equal((await f.request('POST', {}, `/api/purchases/${id}/claim`)).body.status, 'unknown');
  assert.deepEqual(f.rows[0], snapshot);
  assert.equal(statusReads, 0);
  assert.equal(f.calls.prepare.length, 0);
  assert.equal(f.calls.submit.length, 0);
});

test('review reserves but dispatches nothing; only one concurrent approval executes exception steps',async()=>{
 const f=fixture();const created=await f.request('POST',{...payload,priceMinor:'500'});
 assert.equal(created.body.status,'awaiting_parent');assert.equal(f.rows[0].reserved,true);assert.equal(f.calls.submit.length,0);
 f.deps.authenticate=async()=>({member:{role:'parent',user_id:'parent',family_id:'family'}});
 const payloadDecision={decision:'approve',binding:created.body.approvalBinding};
 const responses=await Promise.all([f.request('POST',payloadDecision,`/api/purchases/${id}/decision`),f.request('POST',payloadDecision,`/api/purchases/${id}/decision`)]);
 assert.ok(responses.every(r=>[200,202].includes(r.statusCode)));
 for(let stage=1;stage<7;stage++)await f.request('POST',{},`/api/purchases/${id}/execute`);
 assert.equal(f.rows[0].status,'claimed');assert.deepEqual(f.calls.prepare,['exception_device','exception_policy','needs_defund','exception_fund','exception_authorize','exception_claim','exception_revoke']);
 assert.equal(f.calls.submit.length,7);assert.equal(JSON.stringify(responses).includes('signature'),false);
});
test('rejection never dispatches and a later approval cannot replace the decision',async()=>{
 const f=fixture();const created=await f.request('POST',{...payload,priceMinor:'500'});
 f.deps.authenticate=async()=>({member:{role:'parent',user_id:'parent',family_id:'family'}});
 const decision={decision:'reject',binding:created.body.approvalBinding};
 assert.equal((await f.request('POST',decision,`/api/purchases/${id}/decision`)).body.status,'rejected');
 assert.equal(f.rows[0].reserved,false);assert.equal(f.calls.submit.length,0);
 assert.equal((await f.request('POST',{...decision,decision:'approve'},`/api/purchases/${id}/decision`)).statusCode,409);
});
test('interrupted exception keeps reservation and replays never prepare replacement steps',async()=>{
 const f=fixture();const created=await f.request('POST',{...payload,priceMinor:'500'});
 f.deps.authenticate=async()=>({member:{role:'parent',user_id:'parent',family_id:'family'}});
 f.ledger.submit=async()=>{throw Error('timeout')};
 const decision={decision:'approve',binding:created.body.approvalBinding};
 await f.request('POST',decision,`/api/purchases/${id}/decision`);
 assert.equal(f.rows[0].status,'unknown');assert.equal(f.rows[0].reserved,true);
 await f.request('POST',decision,`/api/purchases/${id}/decision`);
 assert.deepEqual(f.calls.prepare,['exception_device']);
});

test('over-cap purchases with insufficient balance are blocked rather than sent for review',async()=>{
 const f=fixture({funds:false});const res=await f.request('POST',{...payload,priceMinor:'500'});
 assert.equal(res.body.status,'blocked');assert.equal(res.body.reason,'INSUFFICIENT_FUNDS');assert.equal(res.body.approvalBinding,null);assert.equal(f.calls.prepare.length,0);
});

test('an admitted stage cannot be executed by a second writer before its checkpoint',async()=>{
 const f=fixture();const created=await f.request('POST',{...payload,priceMinor:'500'});
 f.deps.authenticate=async()=>({member:{role:'parent',user_id:'parent',family_id:'family'}});
 let finish;const original=f.ledger.submit;f.ledger.submit=async signed=>{await new Promise(resolve=>{finish=resolve});await original(signed)};
 const first=f.request('POST',{decision:'approve',binding:created.body.approvalBinding},`/api/purchases/${id}/decision`);
 while(!finish)await new Promise(resolve=>setImmediate(resolve));
 const duplicate=await f.request('POST',{},`/api/purchases/${id}/execute`);
 assert.equal(duplicate.body.executionStarted,true);assert.deepEqual(f.calls.prepare,['exception_device']);
 finish();await first;assert.equal(f.rows[0].exception_stage,1);assert.equal(f.rows[0].exception_started,false);
});
test('Wants uses its own policy and escrow, and replay cannot switch buckets', async () => {
  const f=fixture();
  f.deps.loadRules=async()=>({revision:3,settings:{...DEFAULT_SETTINGS,needsCategories:[],wantsCategories:['school_supplies']}});
  const devices=[]; const prepare=f.ledger.prepare;
  f.ledger.prepare=async(stage,row,device)=>{devices.push(device);return prepare(stage,row,device);};
  const result=await f.request('POST',{...payload,bucket:'wants'});
  assert.equal(result.body.status,'claimed');assert.equal(result.body.bucket,'wants');
  const {createHash}=await import('node:crypto');
  assert.deepEqual(devices,Array(3).fill(createHash('sha256').update('PadalaPocket Wants family').digest('hex')));
  assert.equal((await f.request('POST',{...payload,bucket:'needs'})).statusCode,409);
  const replay=await f.request('POST',{...payload,bucket:'wants'});assert.equal(replay.body.id,result.body.id);assert.equal(f.calls.submit.length,3);
});
test('available Wants subtracts only Wants reservations', async()=>{
  const f=fixture({rows:[{id,status:'claimed',student_id:student,family_id:'family',bucket:'wants',amount_stroops:'2500000',reserved:true,steps:{}}]});
  const result=await f.request('GET');assert.equal(result.body.availableNeedsStroops,'10000000');assert.equal(result.body.availableWantsStroops,'5500000');
});
test('unknown bucket fails before photo identification',async()=>{const f=fixture();assert.equal((await f.request('POST',{...payload,bucket:'savings'})).statusCode,400);assert.equal(f.calls.ai,0);});
