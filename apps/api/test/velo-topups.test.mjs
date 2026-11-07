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
