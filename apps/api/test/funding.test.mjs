import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Keypair } from '@stellar/stellar-sdk';
import { funding } from '../src/funding.mjs';
const res = () => ({ setHeader() {}, end(raw) { this.body = JSON.parse(raw); } });
const key = '8de9b1e9-bb2b-4f7d-886e-86f588b769f6';
function fixture({ ledgerStatus = 'NOT_FOUND', balance = 10000000n, steps = { fund: { hash: 'exact-stored-hash' } } } = {}) {
  const row = { id: 'op', coordinator_version:8, status: 'unknown', steps, amount_stroops: '10000000', device_hash: 'device' };
  const hashes = [];
  let inserts = 0;
  const query = {
    select() { return this; },
    eq() { return this; },
    order: async () => ({ data: [row] }),
    maybeSingle: async () => ({ data: row }),
    insert() { inserts++; throw Error('Unexpected insert'); },
    update(patch) { return { eq() { return this; }, select() { return this; },
      maybeSingle: async () => ({ data: { ...row, ...patch } }) }; },
  };
  const deps = {
    authenticate: async () => ({ member: { role: 'parent', family_id: 'family', user_id: 'parent' } }),
    database: () => ({ from: () => query }),
    ledger: () => ({ server: { httpClient: { defaults: {} } }, getEscrowBalance: async () => balance }),
    writers: { managed: () => false, dispatch() { throw Error('Unexpected dispatch'); }, observe: async ({row,stage}) => {
      if(row.coordinator_version===0)return {outcome:'fenced'};
      hashes.push(row.steps[stage].hash); return {outcome:ledgerStatus==='SUCCESS'?'confirmed':'fenced'};
    } },
  };
  return { row, hashes, deps, inserts: () => inserts, setStatus: value => { ledgerStatus = value; } };
}
for (const method of ['GET', 'POST']) test(`unauthenticated ${method} is denied before database or ledger access`, async () => {
  const response = res();
  await funding({ method, headers: {} }, response, { database() { assert.fail('database accessed'); }, ledger() { assert.fail('ledger accessed'); } });
  assert.equal(response.statusCode, 401);
});
test('student funding is refused before privileged database access', async () => {
  const response = res();
  await funding({ method: 'POST' }, response, { authenticate: async () => ({ member: { role: 'student' } }), database() { assert.fail('database accessed'); } });
  assert.equal(response.statusCode, 403);
});
for (const status of ['NOT_FOUND', 'FAILED', 'SUCCESS']) test(`saved funding hash reconciles ${status} without dispatch`, async () => {
  const f = fixture({ ledgerStatus: status }); const response = res();
  await funding({ method: 'GET' }, response, f.deps);
  assert.equal(response.statusCode, 200);
  assert.deepEqual(f.hashes, ['exact-stored-hash']);
  assert.equal(f.row.status, status === 'SUCCESS' ? 'confirmed' : 'unknown');
  assert.equal(response.body.confirmedNeedsStroops, status === 'SUCCESS' ? '10000000' : '0');
  if (status === 'SUCCESS') assert.equal(f.row.escrow_stroops, '10000000');
});
test('ledger SUCCESS with insufficient escrow never confirms or credits', async () => {
  const f = fixture({ ledgerStatus: 'SUCCESS', balance: 9999999n }); const response = res();
  await funding({ method: 'GET' }, response, f.deps);
  assert.equal(response.statusCode, 503); assert.equal(f.row.status, 'unknown');
  assert.equal(response.body.confirmedNeedsStroops, undefined); assert.equal(f.row.escrow_stroops, undefined);
});
test('concurrent same-key replays return one durable operation without inserting or sending', async () => {
  const f = fixture({ ledgerStatus: 'SUCCESS' });
  const responses = await Promise.all([1, 2].map(async () => { const response = res();
    await funding({ method: 'POST', headers: { 'idempotency-key': key }, body: { priceMinor: '968' } }, response, f.deps); return response;
  }));
  assert.equal(f.inserts(), 0);
  for (const response of responses) { assert.equal(response.statusCode, 200); assert.equal(response.body.id, 'op'); assert.equal(response.body.transactionHash, 'exact-stored-hash'); }
});
test('interrupted registration replay stays blocked and never prepares a funding transaction', async () => {
  const f = fixture({ steps: { device: { hash: 'registration-hash', signed: 'stored-envelope' } } }); const response = res();
  await funding({ method: 'POST', headers: { 'idempotency-key': key }, body: { priceMinor: '968' } }, response, f.deps);
  assert.equal(response.statusCode, 200); assert.equal(response.body.status, 'unknown'); assert.equal(f.inserts(), 0);
});

test('fresh request recovers a previously unknown hash only after SUCCESS and backing read', async () => {
  const f = fixture(); const first = res();
  await funding({ method: 'GET' }, first, f.deps);
  assert.equal(first.body.confirmedNeedsStroops, '0');
  f.setStatus('SUCCESS'); const second = res();
  await funding({ method: 'GET' }, second, f.deps);
  assert.equal(second.body.operations[0].status, 'confirmed');
  assert.equal(second.body.confirmedNeedsStroops, '10000000');
  assert.deepEqual(f.hashes, ['exact-stored-hash', 'exact-stored-hash']);
});

test('split allocation credits neither bucket until both saved transfers succeed', async()=>{
 const f=fixture({ledgerStatus:'SUCCESS',balance:10000000n});
 Object.assign(f.row,{amount_stroops:'6000000',wants_stroops:'4000000',total_stroops:'10000000',rules_revision:1,wants_device_hash:'wants'});
 let response=res(); await funding({method:'GET'},response,f.deps);
 assert.equal(f.row.status,'unknown'); assert.equal(response.body.confirmedNeedsStroops,'0'); assert.equal(response.body.confirmedWantsStroops,'0');
 f.row.steps.wantsFund={hash:'wants-hash'};
 response=res(); await funding({method:'GET'},response,f.deps);
 assert.equal(f.row.status,'confirmed'); assert.equal(response.body.confirmedNeedsStroops,'6000000'); assert.equal(response.body.confirmedWantsStroops,'4000000');
});
test('failed second allocation transfer retains the unresolved journal',async()=>{
 const f=fixture({ledgerStatus:'FAILED'});Object.assign(f.row,{wants_stroops:'4000000',rules_revision:1,steps:{fund:{hash:'needs'},wantsFund:{hash:'wants'}}});
 const response=res();await funding({method:'GET'},response,f.deps);assert.equal(f.row.status,'unknown');assert.equal(response.body.confirmedWantsStroops,'0');
});

test('pre-cutover unknown funding stays reserved even when a provider would report success',async()=>{
 const f=fixture({ledgerStatus:'SUCCESS'});f.row.coordinator_version=0;
 const response=res();await funding({method:'GET'},response,f.deps);
 assert.equal(response.statusCode,200);assert.equal(response.body.operations[0].status,'unknown');
 assert.equal(response.body.confirmedNeedsStroops,'0');assert.deepEqual(f.hashes,[]);
});

for (const initial of ['confirmed', 'dispatching', 'historical']) {
 test(`split POST resumes only after durable Needs confirmation (${initial})`, async t => {
  const f=fixture({steps:{}});
  Object.assign(f.row,{amount_stroops:'6000000',wants_stroops:'4000000',total_stroops:'10000000',rules_revision:1,
   wants_device_hash:'wants',coordinator_version:initial==='historical'?0:8});
  Object.assign(f.row,{id:key,parent_id:'parent',family_id:'family'});
  const owner=Keypair.random();
  const prior=process.env.OWNER_SECRET;
  process.env.OWNER_SECRET=owner.secret();
  t.after(()=>{if(prior===undefined)delete process.env.OWNER_SECRET;else process.env.OWNER_SECRET=prior;});
  f.deps.ledger=()=>({server:{httpClient:{defaults:{}}},getDeviceOwner:async()=>owner.publicKey(),getEscrowBalance:async()=>10000000n});
  const journal=new Map([['fund',{phase:initial,transactionHash:'journal-needs'}]]);
  const dispatched=[];
  f.deps.writers={
   managed:row=>row.coordinator_version===8,
   observe:async({stage})=>{
    const state=journal.get(stage);
    if(!state)return {outcome:'fenced',reason:'NO_DISPATCH_RECORD'};
    return {...state,outcome:state.phase==='confirmed'?'confirmed':'fenced',reason:'TRANSACTION_NOT_FOUND'};
   },
   dispatch:async({stage})=>{
    dispatched.push(stage);
    const result={phase:'confirmed',transactionHash:'journal-wants'};
    journal.set(stage,result);
    return result;
   },
  };
  const replay=async()=>{
   const response=res();
   const byId=initial==='confirmed';
   await funding({method:'POST',url:'/api/allowance-funding',headers:byId?{}:{'idempotency-key':key},
    body:byId?{resumeId:f.row.id}:{expectedRevision:1}},response,f.deps);
   assert.equal(response.statusCode,200);
   return response.body;
  };
  if(initial!=='confirmed'){
   assert.equal((await replay()).status,'unknown');
   assert.deepEqual(dispatched,[]);
   if(initial==='historical')return;
   journal.get('fund').phase='confirmed';
  }
  const completed=await replay();
  assert.equal(completed.status,'confirmed');
  assert.equal(completed.transactionHash,'journal-needs');
  assert.equal(completed.wantsTransactionHash,'journal-wants');
  assert.equal((await replay()).status,'confirmed');
  assert.deepEqual(dispatched,['wantsFund']);
  assert.equal(f.inserts(),0);
 });
}

test('resume is scoped to an existing allowance owned by this parent and never admits a new row',async()=>{
 const f=fixture({steps:{}});
 const row={...f.row,id:key,parent_id:'other-parent',family_id:'family',rules_revision:1};
 const filters=new Map();
 f.deps.database=()=>({from:()=>({
  select(){return this;},
  eq(column,value){filters.set(column,value);return this;},
  async maybeSingle(){return {data:[...filters].every(([column,value])=>row[column]===value)?row:null};},
  insert(){assert.fail('resume attempted a new allowance');},
 })});
 const response=res();
 await funding({method:'POST',url:'/api/allowance-funding',headers:{},body:{resumeId:key}},response,f.deps);
 assert.equal(response.statusCode,404);
 assert.equal(response.body.error.code,'NOT_FOUND');
 row.parent_id='parent';
 const fenced=res();
 await funding({method:'POST',url:'/api/allowance-funding',headers:{},body:{resumeId:key}},fenced,f.deps);
 assert.equal(fenced.statusCode,409);
 assert.equal(fenced.body.error.code,'FUNDING_PENDING');
});
