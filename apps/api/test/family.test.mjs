import { test } from 'node:test';
import assert from 'node:assert/strict';
import { family, DEFAULT_SETTINGS, validSettings, purchaseRulesFromSettings } from '../src/family.mjs';

function fixture(role = 'parent') {
  let saved = null, calls = 0, lastColumns;
  const rows = [
    { id:'a',family_id:'family',student_id:'child',status:'claimed',price_minor:'242',amount_stroops:'2500000',ai:{productName:'Notebook',category:'books'},photo_base64:'PRIVATE',steps:{signed:'SECRET'},ai_usage:{private:'DIAGNOSTIC'} },
    { id:'b',family_id:'family',student_id:'other-child',status:'blocked',price_minor:'242',amount_stroops:'2500000' },
    { id:'c',family_id:'other-family',student_id:'child',status:'claimed',price_minor:'242',amount_stroops:'2500000' },
  ];
  const db = {
    from(name) { calls++; const filters = []; return {
      select(columns) { lastColumns = columns; return this; }, eq(key,value) { filters.push([key,value]); return this; },
      maybeSingle: async () => ({ data: saved && structuredClone(saved) }), order() { return this; },
      limit: async () => ({ data: rows.filter(row => filters.every(([k,v])=>row[k]===v)) }),
    }; },
    async rpc(_, args) {
      if ((saved?.revision ?? 0) !== args.p_expected) return { data:null };
      saved = { revision:args.p_expected+1,settings:structuredClone(args.p_settings),updated_at:'2026-11-07T00:00:00Z' };
      return { data:structuredClone(saved) };
    },
  };
  const deps = { database:()=>db,authenticate:async()=>({member:{role,user_id:'child',family_id:'family'}}) };
  const call = async (method='GET',body,url='/api/family/rules') => { const res={setHeader(){},end(raw){this.body=JSON.parse(raw)}};await family({method,body,url,headers:{}},res,deps);return res; };
  return { deps, call, calls:()=>calls, columns:()=>lastColumns };
}
test('anonymous requests fail before privileged database access',async()=>{const f=fixture();f.deps.authenticate=async()=>{throw Object.assign(Error('Sign in'),{status:401,code:'UNAUTHENTICATED'})};assert.equal((await f.call()).statusCode,401);assert.equal(f.calls(),0)});
test('student may read rules but may not save them',async()=>{const f=fixture('student');assert.equal((await f.call()).body.revision,0);const before=f.calls();assert.equal((await f.call('PUT',{expectedRevision:0,settings:DEFAULT_SETTINGS})).statusCode,403);assert.equal(f.calls(),before)});
test('parent saves durable rules and stale/concurrent revisions conflict',async()=>{const f=fixture();const settings={...DEFAULT_SETTINGS,capMinor:'600',needsCategories:['books']};const responses=await Promise.all([f.call('PUT',{expectedRevision:0,settings}),f.call('PUT',{expectedRevision:0,settings})]);assert.deepEqual(responses.map(r=>r.statusCode).sort(),[200,409]);const read=await f.call();assert.equal(read.body.revision,1);assert.deepEqual(read.body.settings,settings);assert.equal(purchaseRulesFromSettings(read.body).capStroops,'6198347')});
test('invalid and unknown policy fields are rejected',async()=>{for(const settings of [{...DEFAULT_SETTINGS,capMinor:'0'},{...DEFAULT_SETTINGS,needsPercent:101},{...DEFAULT_SETTINGS,needsCategories:['unknown']},{...DEFAULT_SETTINGS,needsCategories:['books','books']},{...DEFAULT_SETTINGS,extra:true}]){assert.equal(validSettings(settings),false);assert.equal((await fixture().call('PUT',{expectedRevision:0,settings})).statusCode,400)}});
test('parent activity is family-scoped and excludes all private journal fields',async()=>{const f=fixture();const res=await f.call('GET',undefined,'/api/family/activity');assert.deepEqual(res.body.items.map(r=>r.id),['a','b']);const body=JSON.stringify(res.body);for(const value of ['PRIVATE','SECRET','DIAGNOSTIC','photo_base64','steps','ai_usage','other-family'])assert.equal(body.includes(value),false);assert.equal(f.columns().includes('photo_base64'),false)});
test('student activity is limited to their own family and user',async()=>{const f=fixture('student');const res=await f.call('GET',undefined,'/api/family/activity');assert.deepEqual(res.body.items.map(r=>r.id),['a']);assert.equal(res.body.items[0].photoPath,'/api/purchases/a/photo')});
