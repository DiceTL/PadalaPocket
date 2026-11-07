import {test} from 'node:test';
import assert from 'node:assert/strict';
import {nextWeeklyTime,allowanceAvailable,bucketDevice} from '../src/weekly-plan.mjs';
test('PHT weekly boundary is strictly future, including same-day and year rollover',()=>{
 assert.equal(nextWeeklyTime('2026-11-07T00:00:00Z',6,'09:00'),'2026-11-07T01:00:00.000Z');
 assert.equal(nextWeeklyTime('2026-11-07T01:00:00Z',6,'09:00'),'2026-11-14T01:00:00.000Z');
 assert.equal(nextWeeklyTime('2026-12-31T20:00:00Z',5,'00:00'),'2027-01-07T16:00:00.000Z');
 assert.throws(()=>nextWeeklyTime('2026-11-07T00:00:00Z',7,'09:00'));
});
test('swept principal cannot be spent again; Needs and Wants conserve independently',()=>{
 const funding=[{amount_stroops:'100',wants_stroops:'80'},{amount_stroops:'60',wants_stroops:'40'}];
 const purchases=[{reserved:true,bucket:'needs',amount_stroops:'30'},{reserved:true,bucket:'wants',amount_stroops:'10'},{reserved:false,bucket:'needs',amount_stroops:'90'}];
 const events=[{needs_stroops:'70',wants_stroops:'70'}];
 assert.equal(allowanceAvailable(funding,purchases,events,'needs'),'60');
 assert.equal(allowanceAvailable(funding,purchases,events,'wants'),'40');
 assert.notEqual(bucketDevice('family','Savings'),bucketDevice('family','My Money'));
});
import {weekly} from '../src/weekly.mjs';
function fixture(role='parent') {
 const event={id:'11111111-1111-4111-8111-111111111111',family_id:'family',parent_id:'parent',rules_revision:0,stage:0,stage_started:false,status:'processing',steps:{},needs_stroops:'100',wants_stroops:'80'};
 const clock={family_id:'family',revision:0,simulated_at:'2026-11-07T00:00:00Z',weekday:0,local_time:'09:00'};
 let prepare=0,submit=0,status='NOT_FOUND';
 const db={from(name){let patch,filters=[],single=false;const run=()=>{let data=name==='weekly_clocks'?[clock]:name==='weekly_events'?[event]:[];data=data.filter(r=>filters.every(([k,v])=>r[k]===v));if(patch)for(const r of data)Object.assign(r,structuredClone(patch));return Promise.resolve({data:structuredClone(single?data[0]??null:data)});};return {select(){return this;},upsert(){return Promise.resolve({data:null});},eq(k,v){filters.push([k,v]);return this;},update(p){patch=p;return this;},single(){single=true;return run();},maybeSingle(){single=true;return run();},order:run,then(a,b){return run().then(a,b);}};}};
 db.rpc=async()=>({data:null});
 const deps={authenticate:async()=>({member:{role,user_id:role,family_id:'family'}}),database:()=>db,ledger:()=>({verify:async()=>true,spendable:async()=>0n,prepare:async()=>{prepare++;return {signed:'envelope',hash:'hash'};},submit:async()=>{submit++;assert.equal(event.steps.savingsDevice.signed,'envelope');},status:async()=>({status})})};
 const call=async(method='POST')=>{const res={setHeader(){},end(v){this.body=JSON.parse(v);}};await weekly({url:method==='POST'?'/api/demo/advance':'/api/weekly',method,headers:{'idempotency-key':event.id},body:{expectedRevision:0}},res,deps);return res;};
 return {event,call,setStatus:s=>{status=s;},counts:()=>({prepare,submit})};
}
test('unknown stage retains its envelope and concurrent/repeated admission cannot dispatch replacement',async()=>{
 const f=fixture();await Promise.all([f.call(),f.call()]);assert.deepEqual(f.counts(),{prepare:1,submit:1});assert.equal(f.event.stage_started,true);
 await f.call();assert.deepEqual(f.counts(),{prepare:1,submit:1});
 f.setStatus('SUCCESS');await f.call();assert.equal(f.event.stage,1);assert.equal(f.event.stage_started,false);assert.deepEqual(f.counts(),{prepare:1,submit:1});
});
test('parent weekly projection excludes private balance and Wants credit; student cannot advance',async()=>{
 const p=await fixture().call('GET');assert.equal(p.statusCode,200);assert.equal('myMoneyStroops' in p.body,false);assert.equal('wantsStroops' in p.body.events[0],false);
 assert.equal((await fixture('student').call()).statusCode,403);
 const s=await fixture('student').call('GET');assert.equal(s.body.myMoneyStroops,'0');
});

test('depleted parent wallet records skipped allocation without preparing or dispatching funding',async()=>{
 const f=fixture();f.event.stage=6;const result=await f.call();assert.equal(result.statusCode,200);assert.equal(result.body.status,'allocation_skipped');assert.deepEqual(f.counts(),{prepare:0,submit:0});
});
