// Explicitly authorized single Testnet purchase: ₱5.00, fixed notebook photo/seller.
// Run once with --run; later --observe reads hashes and replays the same closed decision; it never creates a purchase.
import { createClient } from '@supabase/supabase-js';
import { readFile,writeFile } from 'node:fs/promises';
import { createHash,randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import { NoirAgentClient } from '@noirx402/agent-sdk';
import { exceptionDevice } from '../src/purchase-approval.mjs';
const mode=process.argv[2];if(!['--run','--observe'].includes(mode))throw Error('Choose --run or --observe explicitly.');
const path='.env.l002-live.json',base='http://127.0.0.1:3001';
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const {accounts,familyId}=JSON.parse(await readFile('.env.r001-accounts.json','utf8'));
const headers={};
for(const account of accounts){const c=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await c.auth.signInWithPassword({email:account.email,password:account.password});assert.equal(error,null);headers[account.role]={Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'};}
async function call(role,suffix,body,key){const r=await fetch(base+'/api/purchases'+suffix,{method:body?'POST':'GET',headers:{...headers[role],...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const json=await r.json();if(!r.ok)throw Error(`API ${r.status}: ${json.error?.code}`);return json;}
const noir=new NoirAgentClient({network:'testnet'});noir.server.httpClient.defaults.timeout=15000;
const device=createHash('sha256').update('PadalaPocket Needs '+familyId).digest('hex');
let journal;
if(mode==='--run'){
 const previous=await db.from('needs_purchases').select('photo_base64,photo_mime').eq('id','1ee64945-4bd4-4ff5-abc2-0a095cf92cd5').single();assert.equal(previous.error,null);
 const before=await call('student','');assert.ok(BigInt(before.availableNeedsStroops)>=5165289n);assert.ok(BigInt(before.rules.capMinor)<500n);
 journal={requestKey:randomUUID(),priceMinor:'500',beforeAvailable:before.availableNeedsStroops,ordinaryPolicy:await noir.getPolicy(device)};
 await writeFile(path,JSON.stringify(journal,(_,v)=>typeof v==='bigint'?v.toString():v),{flag:'wx',mode:0o600});
 const purchase=await call('student','',{sellerId:'demo-seller',priceMinor:'500',mime:previous.data.photo_mime,photoBase64:previous.data.photo_base64},journal.requestKey);
 journal.id=purchase.id;journal.binding=purchase.approvalBinding;await writeFile(path,JSON.stringify(journal,(_,v)=>typeof v==='bigint'?v.toString():v),{mode:0o600});
 assert.equal(purchase.status,'awaiting_parent');assert.equal(purchase.ai.category,'school_supplies');
 console.log(JSON.stringify({phase:'awaiting_parent',id:purchase.id,amountStroops:purchase.amountStroops}));
 let approved=await call('parent',`/${purchase.id}/decision`,{decision:'approve',binding:purchase.approvalBinding});
 while(['approved','exception_pending'].includes(approved.status)&&!approved.executionStarted)approved=await call('parent',`/${purchase.id}/execute`,{});
 console.log(JSON.stringify({phase:'decision_result',status:approved.status,id:approved.id,transactions:approved.transactions}));
} else journal=JSON.parse(await readFile(path,'utf8'));
journal=JSON.parse(await readFile(path,'utf8'));
const history=await call('parent','');const row=history.purchases.find(p=>p.id===journal.id);assert.ok(row);
if(row.status!=='claimed'){console.log(JSON.stringify({status:row.status,reason:row.reason,transactions:row.transactions}));process.exitCode=2;}
else {
 for(const tx of Object.values(row.transactions))assert.equal((await noir.server.getTransaction(tx.hash)).status,'SUCCESS');
 assert.equal(await noir.getEscrowBalance(exceptionDevice(row)),0n);assert.equal(await noir.getPolicy(exceptionDevice(row)),null);
 const actual=JSON.parse(JSON.stringify(await noir.getPolicy(device),(_,v)=>typeof v==='bigint'?v.toString():v));
 assert.deepEqual(actual,journal.ordinaryPolicy);
 const student=await call('student','');assert.equal(BigInt(student.availableNeedsStroops),BigInt(journal.beforeAvailable)-BigInt(row.amountStroops));
 const replay=await call('parent',`/${row.id}/decision`,{decision:'approve',binding:journal.binding});assert.deepEqual(replay.transactions,row.transactions);
 console.log(JSON.stringify({verified:true,id:row.id,status:row.status,ordinaryPolicyUnchanged:true,exceptionEscrow:'0',exceptionPolicy:null,availableNeeds:student.availableNeedsStroops,transactions:row.transactions}));
}
