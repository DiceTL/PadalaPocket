import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/client/api.js';
import { createAppController } from '../src/app/controller.js';
test('live purchase client sends the frozen payload, bearer and idempotency key', async () => {
  const calls = []; const payload = { sellerId: 'demo-seller', priceMinor: '242', mime: 'image/png', photoBase64: 'test' };
  const api = createApiClient({ mode: 'live', getAccessToken: async () => 'token', fetchImpl: async (url, options) => { calls.push({ url, options }); return { ok: true, json: async () => ({ status: 'merchant_pending' }) }; } });
  assert.equal((await api.purchases('POST', payload, 'key')).status, 'merchant_pending');
  assert.equal(calls[0].url, '/api/purchases'); assert.equal(calls[0].options.headers.Authorization, 'Bearer token');
  assert.equal(calls[0].options.headers['Idempotency-Key'], 'key'); assert.deepEqual(JSON.parse(calls[0].options.body), payload);
});
test('student reload restores real purchase history; explicit claim reloads backend status', async () => {
  let status = 'merchant_pending'; let claims = 0;
  const controller = createAppController({ auth: { mode: 'live' }, api: { mode: 'live', getMe: async () => ({ userId: 'student', role: 'student' }), purchases: async (method, _, key, suffix) => {
    if (method === 'POST') { assert.equal(suffix, '/purchase/claim'); assert.equal(key, undefined); claims++; status = 'claimed'; return { status }; }
    return { purchases: [{ id: 'purchase', status }] };
  } } });
  await controller.restore(); assert.equal(controller.getState().purchaseHistory.purchases[0].status, 'merchant_pending');
  await controller.claimPurchase('purchase'); assert.equal(claims, 1); assert.equal(controller.getState().purchaseHistory.purchases[0].status, 'claimed');
});
test('mock purchase client cannot silently call the live endpoint', async () => {
  const api = createApiClient({ mode: 'mock', fetchImpl: () => assert.fail('live request') }); await assert.rejects(api.purchases(), /live API/);
});
test('student submission passes selected bucket and gives each bucket a distinct request key',async()=>{
 const previous={FileReader:globalThis.FileReader,localStorage:globalThis.localStorage};const storage=new Map();const calls=[];
 globalThis.localStorage={getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v)};
 globalThis.FileReader=class {readAsDataURL(){this.result='data:image/png;base64,cGhvdG8=';this.onload();}};
 try {
  const controller=createAppController({auth:{mode:'live'},api:{mode:'live',getMe:async()=>({userId:'student',role:'student'}),purchases:async(method,payload,key)=>{if(method==='POST')calls.push({payload,key});return{purchases:[]};}}});
  await controller.restore();const file={type:'image/png',size:5};
  await controller.submitPurchase(file,'1.00','wants');await controller.submitPurchase(file,'1.00','needs');
  assert.deepEqual(calls.map(c=>c.payload.bucket),['wants','needs']);assert.notEqual(calls[0].key,calls[1].key);
 }finally{globalThis.FileReader=previous.FileReader;globalThis.localStorage=previous.localStorage;}
});
