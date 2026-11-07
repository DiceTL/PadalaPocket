// One founder-authorized ₱1.00 Wants purchase. The durable journal forbids a second run.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {createClient} from '@supabase/supabase-js';
import {exceptionDevice} from '../src/purchase-approval.mjs';
import {NoirAgentClient} from '@noirx402/agent-sdk';
const mode=process.argv[2];assert.ok(['--run','--observe'].includes(mode),'Use --run or --observe');
const path='.env.l003-wants.json',base='http://127.0.0.1:3002';
const {accounts,familyId}=JSON.parse(await readFile('.env.r001-accounts.json','utf8'));
const headers={};for(const a of accounts){const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});const {data,error}=await auth.auth.signInWithPassword(a);assert.equal(error,null);headers[a.role]={Authorization:`Bearer ${data.session.access_token}`,'Content-Type':'application/json'};}
async function call(role,suffix='',body,key){const r=await fetch(base+'/api/purchases'+suffix,{method:body?'POST':'GET',headers:{...headers[role],...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();assert.ok(r.ok,`API ${r.status}: ${data.error?.code}`);return data;}
const noir=new NoirAgentClient({network:'testnet'});noir.server.httpClient.defaults.timeout=15000;
const device=b=>createHash('sha256').update(`PadalaPocket ${b} ${familyId}`).digest('hex');
const snapshot=async()=>{const app=await call('student');return{needs:app.availableNeedsStroops,wants:app.availableWantsStroops,needsEscrow:String(await noir.getEscrowBalance(device('Needs'))),wantsEscrow:String(await noir.getEscrowBalance(device('Wants')))}};
let j;
const save=()=>writeFile(path,JSON.stringify(j,null,2),{mode:0o600});
if(mode==='--run'){
 j={key:randomUUID(),before:await snapshot()};assert.ok(BigInt(j.before.wants)>=1033058n);
 await writeFile(path,JSON.stringify(j),{flag:'wx',mode:0o600});
 const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
 const {data:photo,error}=await db.from('needs_purchases').select('photo_base64,photo_mime').eq('id','1ee64945-4bd4-4ff5-abc2-0a095cf92cd5').single();assert.equal(error,null);
 let row=await call('student','',{bucket:'wants',sellerId:'demo-seller',priceMinor:'100',mime:photo.photo_mime,photoBase64:photo.photo_base64},j.key);
 j.id=row.id;j.status=row.status;await save();console.log(JSON.stringify({phase:'submitted',id:row.id,status:row.status}));
 if(row.status==='awaiting_parent')row=await call('parent',`/${row.id}/decision`,{decision:'approve',binding:row.approvalBinding});
 for(let n=0;n<7 && ['approved','exception_pending'].includes(row.status)&&!row.executionStarted;n++){j.status=row.status;j.transactions=row.transactions;await save();row=await call('parent',`/${row.id}/execute`,{});console.log(JSON.stringify({phase:'stage',completed:row.completedStages,status:row.status}));}
 j.status=row.status;await save();
}else j=JSON.parse(await readFile(path,'utf8'));
const row=(await call('parent')).purchases.find(p=>p.id===j.id);assert.equal(row?.status,'claimed');assert.equal(row.bucket,'wants');
for(const tx of Object.values(row.transactions))assert.equal((await noir.server.getTransaction(tx.hash)).status,'SUCCESS');
if(row.parentDecision){assert.equal(await noir.getEscrowBalance(exceptionDevice(row)),0n);assert.equal(await noir.getPolicy(exceptionDevice(row)),null);}
j.after=await snapshot();j.transactions=row.transactions;
assert.equal(j.after.needs,j.before.needs);assert.equal(j.after.needsEscrow,j.before.needsEscrow);
assert.equal(BigInt(j.before.wants)-BigInt(j.after.wants),1033058n);assert.equal(BigInt(j.before.wantsEscrow)-BigInt(j.after.wantsEscrow),1033058n);
j.verified=true;await save();console.log(JSON.stringify({verified:true,id:row.id,before:j.before,after:j.after,transactions:row.transactions}));
