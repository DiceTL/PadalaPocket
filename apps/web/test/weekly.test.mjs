import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createAppController} from '../src/app/controller.js';
import {createApiClient} from '../src/client/api.js';
test('weekly client sends bearer, clock revision and stable action identity',async()=>{
 let request;const client=createApiClient({mode:'live',getAccessToken:async()=>'token',fetchImpl:async(url,options)=>{request={url,options};return {ok:true,json:async()=>({stage:1})};}});
 await client.weekly('POST',{expectedRevision:3},'same-week');assert.equal(request.url,'/api/demo/advance');assert.equal(request.options.headers.Authorization,'Bearer token');assert.equal(request.options.headers['Idempotency-Key'],'same-week');assert.deepEqual(JSON.parse(request.options.body),{expectedRevision:3});
});
test('a new browser resumes the server active week and stops on an admitted uncertain stage',async()=>{
 const saved=globalThis.localStorage;const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)};
 try{let posts=0;const api={mode:'live',getMe:async()=>({userId:'parent',role:'parent'}),funding:async()=>({operations:[]}),weekly:async(method,body,key)=>{if(method==='POST'){posts++;assert.equal(key,'existing-event');return {status:'unknown',stageStarted:true};}return {clock:{revision:2},events:[{id:'existing-event',status:'processing'}]};}};
 const controller=createAppController({auth:{mode:'live'},api});await controller.restore();await controller.advanceWeek();assert.equal(posts,1);assert.equal(controller.getState().weeklyBusy,false);assert.equal(JSON.parse(memory.get('weeklyAdvance:parent')).key,'existing-event');
 }finally{globalThis.localStorage=saved;}
});
