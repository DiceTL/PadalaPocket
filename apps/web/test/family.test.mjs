import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient } from '../src/client/api.js';
import { createAppController } from '../src/app/controller.js';
test('rules saves send bearer and expected revision; photo reads remain authenticated blobs',async()=>{
 const calls=[];const api=createApiClient({mode:'live',getAccessToken:async()=>'token',fetchImpl:async(url,options)=>{calls.push({url,options});return{ok:true,json:async()=>({revision:2}),blob:async()=>new Blob(['photo'],{type:'image/jpeg'})}}});
 await api.familyRules({capMinor:'484'},1);assert.equal(calls[0].options.headers.Authorization,'Bearer token');assert.deepEqual(JSON.parse(calls[0].options.body),{settings:{capMinor:'484'},expectedRevision:1});
 await api.purchasePhoto('11111111-1111-4111-8111-111111111111');assert.equal(calls[1].options.headers.Authorization,'Bearer token');assert.equal(calls[1].url,'/api/purchases/11111111-1111-4111-8111-111111111111/photo');await assert.rejects(api.purchasePhoto('https://other.test'),/Invalid photo/);
});
test('live controller restores saved rules/activity; successful saves advance revision',async()=>{
 let saved={revision:1,settings:{capMinor:'484'},categories:[]};const api={mode:'live',getMe:async()=>({userId:'parent',role:'parent'}),funding:async()=>({operations:[]}),activity:async()=>({items:[]}),familyRules:async(settings,revision)=>{if(settings){assert.equal(revision,1);saved={...saved,revision:2,settings}}return structuredClone(saved)}};
 const controller=createAppController({auth:{mode:'live'},api});await controller.restore();assert.equal(controller.getState().familyRules.revision,1);await controller.saveFamilyRules({capMinor:'600'});assert.equal(controller.getState().familyRules.revision,2);assert.equal(controller.getState().rulesSaved,true);
});
test('a late rules save cannot restore data after sign-out',async()=>{
 let finish;const api={mode:'live',getMe:async()=>({userId:'parent',role:'parent'}),funding:async()=>({}),activity:async()=>({items:[]}),familyRules:async(settings)=>settings?new Promise(resolve=>{finish=resolve}):({revision:0,settings:{},categories:[]})};
 const controller=createAppController({auth:{mode:'live',signOut:async()=>{}},api});await controller.restore();const pending=controller.saveFamilyRules({capMinor:'600'});await controller.signOut();finish({revision:1,settings:{capMinor:'600'}});await pending;assert.equal(controller.getState().screen,'signin');assert.equal(controller.getState().familyRules,undefined);
});
