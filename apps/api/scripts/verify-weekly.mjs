// Explicit, bounded Testnet rehearsal; journal prevents accidentally starting a second week.
import {readFile,writeFile} from 'node:fs/promises';
import {createClient} from '@supabase/supabase-js';
import {NoirAgentClient} from '@noirx402/agent-sdk';
import {bucketDevice} from '../src/weekly-plan.mjs';
const path='.env.l004-weekly.json',command=process.argv[2];
if(!['--run','--observe'].includes(command))throw Error('Use --run or --observe');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
const {accounts}=JSON.parse(await readFile('.env.r001-accounts.json','utf8')),account=accounts.find(a=>a.role==='parent');
const {data,error}=await auth.auth.signInWithPassword({email:account.email,password:account.password});if(error)throw Error('LOGIN_FAILED');
const token=data.session.access_token;
async function api(method='GET',body,key){const r=await fetch('http://127.0.0.1:3003'+(method==='POST'?'/api/demo/advance':'/api/weekly'),{method,headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},...(body?{body:JSON.stringify(body)}:{})});const result=await r.json();if(!r.ok)throw Error(result.error?.code??'API_FAILED');return result;}
const family=(await db.from('family_members').select('family_id').eq('user_id',data.user.id).single()).data.family_id;
const noir=new NoirAgentClient({network:'testnet'});noir.server.httpClient.defaults.timeout=15000;
async function balances(){return Object.fromEntries(await Promise.all(['Needs','Wants','Savings','My Money'].map(async b=>[b,String(await noir.getEscrowBalance(bucketDevice(family,b)))])));}
let state;
if(command==='--run'){
 state={id:crypto.randomUUID(),before:await balances(),clock:(await api()).clock,events:[],createdAt:new Date().toISOString()};
 if(state.before.Needs!=='9117769'||state.before.Wants!=='5913223')throw Error('AUTHORIZED_BALANCES_CHANGED');
 const rules=await db.from('family_rules').select('revision,settings').eq('family_id',family).single();if(rules.data.settings.weeklyAmountMinor!=='968'||rules.data.settings.needsPercent!==60)throw Error('AUTHORIZED_ALLOCATION_CHANGED');
 await writeFile(path,JSON.stringify(state,null,2),{mode:0o600,flag:'wx'});
 const local=new Date(Date.parse(state.clock.simulatedAt)+8*3600000),time=local.toISOString().slice(11,16);
 await api('PUT',{expectedRevision:state.clock.revision,weekday:local.getUTCDay(),time});state.revision=(await api()).clock.revision;
 await writeFile(path,JSON.stringify(state,null,2),{mode:0o600});
 for(let i=0;i<8;i++){
  const result=await api('POST',{expectedRevision:state.revision},state.id);state.events.push(result);await writeFile(path,JSON.stringify(state,null,2),{mode:0o600});
  console.log(JSON.stringify({id:state.id,status:result.status,stage:result.stage}));
  if(['confirmed','allocation_skipped'].includes(result.status))break;
  if(result.stageStarted||result.status==='unknown')throw Error('UNKNOWN_STOPPED_NO_RETRY');
 }
}else state=JSON.parse(await readFile(path,'utf8'));
state.after=await balances();
const event=(await db.from('weekly_events').select('*').eq('id',state.id).single()).data;
if(!event)throw Error('EVENT_MISSING');
state.hashes={};for(const [stage,step] of Object.entries(event.steps))state.hashes[stage]={hash:step.hash,status:(await noir.server.getTransaction(step.hash)).status};
const allocation=(await db.from('needs_funding').select('status,steps').eq('parent_id',data.user.id).eq('request_key',state.id).single()).data;
for(const [stage,step] of Object.entries(allocation?.steps??{}))state.hashes['allocation_'+stage]={hash:step.hash,status:(await noir.server.getTransaction(step.hash)).status};
state.verified=allocation?.status==='confirmed' && event.status==='confirmed' && Object.values(state.hashes).every(v=>v.status==='SUCCESS') && state.after.Needs==='6000000' && state.after.Wants==='4000000' && BigInt(state.after.Savings)-BigInt(state.before.Savings)===9117769n && BigInt(state.after['My Money'])-BigInt(state.before['My Money'])===5913223n;
await writeFile(path,JSON.stringify(state,null,2),{mode:0o600});
if(command==='--run' && ['confirmed','allocation_skipped'].includes(event.status)){
 const restored=await db.from('weekly_clocks').update({weekday:state.clock.weekday,local_time:state.clock.time}).eq('family_id',family);if(restored.error)throw Error('SCHEDULE_RESTORE_FAILED');
}
console.log(JSON.stringify({verified:state.verified,before:state.before,after:state.after,hashes:state.hashes}));
if(!state.verified)process.exitCode=1;
