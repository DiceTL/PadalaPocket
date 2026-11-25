import {test} from 'node:test';import assert from 'node:assert/strict';
import {validateIntent,xlmAmount,veloTopups} from '../src/velo-topups.mjs';
const row={amount_stroops:'10000000',expected_receiver:'parent'};
const intent={paymentIntentId:'abcdefghijklmnopqrstuvwx',amount:'1.0000000',asset:'native',status:'created',receiverAddress:'parent',checkoutUrl:'https://www.velo-build.dev/pay/test'};
test('checkout bound to receiver, native asset and exact integer amount',()=>{
 assert.equal(xlmAmount('10000001'),'1.0000001');assert.equal(validateIntent(intent,row).status,'created');
 assert.deepEqual(validateIntent({...intent,receiverAddress:'other',status:'paid'},row),{intent_id:intent.paymentIntentId,status:'configuration_required',checkout_url:null});
 for(const patch of [{asset:'USDC'},{amount:'1.0000001'},{status:'success'},{checkoutUrl:'https://evil.example/pay'},{checkoutUrl:'https://www.velo-build.dev.evil.example/pay'}])assert.throws(()=>validateIntent({...intent,...patch},row));
 assert.throws(()=>validateIntent(intent,{...row,intent_id:'another-intent'}));
});
test('unauthenticated and student access never reach provider or database',async()=>{
 for(const role of ['student','anonymous']){const res={setHeader(){},end(b){this.body=JSON.parse(b)}};await veloTopups({method:'POST'},res,{authenticate:async()=>{if(role==='anonymous')throw Object.assign(Error(),{status:401,code:'UNAUTHORIZED'});return {member:{role}};},database(){assert.fail('database');},provider(){assert.fail('provider');}});assert.equal(res.statusCode,role==='student'?403:401);}
});

import { Keypair } from '@stellar/stellar-sdk';
function topupFixture() {
 const rows=[];let providerCalls=0;
 const deps={
  authenticate:async()=>({member:{role:'parent',user_id:'parent',family_id:'family'}}),
  loadRules:async()=>({revision:1,settings:{weeklyAmountMinor:'968'}}),
  database:()=>({rpc:async name=>({data:name==='read_parent_balance'?{confirmedDepositStroops:'0',pendingDepositStroops:'0',confirmedAllocationStroops:'0',pendingAllocationStroops:'0',confirmedHoldingsStroops:'0',availableStroops:'0',basis:'confirmed_journal',deposits:[]}:null}),from(){let patch;return {
   select(){return this;},eq(){return this;},order(){return this;},limit:async()=>({data:rows}),
   maybeSingle:async()=>({data:null}),
   insert(value){rows.push({...value,id:'topup',created_at:'2026-11-21T00:00:00Z',status:'creating'});return this;},
   single:async()=>({data:structuredClone(rows[0])}),
   update(value){patch=value;const chain={eq(){return chain;},is(){return chain;},select(){return chain;},
    maybeSingle:async()=>{Object.assign(rows[0],patch);return {data:structuredClone(rows[0]),error:null};},
    then(resolve,reject){Object.assign(rows[0],patch);return Promise.resolve({error:null}).then(resolve,reject);},
   };return chain;},
  };}}),
  provider:()=>{providerCalls++;return {checkout:{sessions:{create:async()=>({...intent,receiverAddress:rows[0].expected_receiver})}}};},
 };
 const call=async(method)=>{const response={setHeader(){},end(raw){this.body=JSON.parse(raw);}};
  await veloTopups({method,headers:{'idempotency-key':'11111111-1111-4111-8111-111111111111'},body:{expectedRevision:1}},response,deps);return response;};
 return {rows,call,providerCalls:()=>providerCalls};
}
function restoreReceiverEnvironment(t) {
 const original={OWNER_SECRET:process.env.OWNER_SECRET,OWNER_PUBLIC_KEY:process.env.OWNER_PUBLIC_KEY};
 t.after(()=>{for(const [key,value] of Object.entries(original)){if(value===undefined)delete process.env[key];else process.env[key]=value;}});
 delete process.env.OWNER_SECRET;
}
test('topup list and creation use the pinned public receiver without any signing secret',async t=>{
 restoreReceiverEnvironment(t);
 process.env.OWNER_PUBLIC_KEY=Keypair.random().publicKey();
 const f=topupFixture(),list=await f.call('GET');
 assert.equal(list.statusCode,200);assert.equal(list.body.expectedReceiver,process.env.OWNER_PUBLIC_KEY);
 const created=await f.call('POST');assert.equal(created.statusCode,201);assert.equal(created.body.status,'created');
 assert.equal(created.body.expectedReceiver,process.env.OWNER_PUBLIC_KEY);
 assert.equal(f.rows[0].expected_receiver,process.env.OWNER_PUBLIC_KEY);assert.equal(f.providerCalls(),1);
});
test('missing or invalid public receiver fails closed without using a retained secret or creating checkout',async t=>{
 restoreReceiverEnvironment(t);process.env.OWNER_SECRET=Keypair.random().secret();
 for(const value of [undefined,'invalid',process.env.OWNER_SECRET]){
  if(value===undefined)delete process.env.OWNER_PUBLIC_KEY;else process.env.OWNER_PUBLIC_KEY=value;
  for(const method of ['GET','POST']){
   const f=topupFixture(),response=await f.call(method);
   assert.equal(response.statusCode,503);assert.equal(response.body.error.code,'VELO_UNAVAILABLE');
   assert.deepEqual(f.rows,[]);assert.equal(f.providerCalls(),0);
   assert.equal(JSON.stringify(response.body).includes(process.env.OWNER_SECRET),false);
  }
 }
});
