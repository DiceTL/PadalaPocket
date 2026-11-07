import {createClient} from '@supabase/supabase-js';
import {authenticateMember} from './identity.mjs';
import {readFamilyRules} from './family.mjs';
import {funding} from './funding.mjs';
import {phpToStroops} from './money-mapping.mjs';
import {nextWeeklyTime,WEEKLY_STAGES} from './weekly-plan.mjs';
import {weeklyLedger} from './weekly-ledger.mjs';
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
export async function weekly(req,res,{authenticate=authenticateMember,database=createClient,ledger=weeklyLedger}={}){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
 try{
  const {member}=await authenticate(req),path=new URL(req.url,'http://localhost').pathname;
  if(!['GET','PUT','POST'].includes(req.method))throw fail(405,'METHOD_NOT_ALLOWED');
  if(req.method!=='GET' && member.role!=='parent')throw fail(403,'FORBIDDEN');
  const db=database(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const check=r=>{if(r.error)throw fail(503,'PROVIDER_UNAVAILABLE');return r.data;};
  check(await db.from('weekly_clocks').upsert({family_id:member.family_id},{onConflict:'family_id',ignoreDuplicates:true}));
  let clock=check(await db.from('weekly_clocks').select('*').eq('family_id',member.family_id).single());
  const events=()=>db.from('weekly_events');
  const projection=e=>({id:e.id,status:e.status,stage:e.stage,stageStarted:e.stage_started,targetAt:e.target_at,needsStroops:String(e.needs_stroops),...(member.role==='student'?{wantsStroops:String(e.wants_stroops)}:{}),notice:e.notice,transactions:Object.fromEntries(Object.entries(e.steps).map(([k,v])=>[k,v.hash]))});
  if(req.method==='GET'){
   const rows=check(await events().select('*').eq('family_id',member.family_id).order('created_at',{ascending:false}));
   const confirmed=e=>e.stage>=4;
   return send(200,{clock:{simulatedAt:clock.simulated_at,revision:clock.revision,weekday:clock.weekday,time:clock.local_time,timezone:'Asia/Manila'},events:rows.map(projection),savingsStroops:rows.filter(confirmed).reduce((n,e)=>n+BigInt(e.needs_stroops),0n).toString(),...(member.role==='student'?{myMoneyStroops:rows.filter(e=>e.stage>=6).reduce((n,e)=>n+BigInt(e.wants_stroops),0n).toString()}:{}),configured:Boolean(process.env.STUDENT_SECRET)});
  }
  let body=req.body;if(body===undefined){let raw='';for await(const c of req){raw+=c;if(raw.length>1024)throw fail(400,'INVALID_INPUT');}try{body=JSON.parse(raw);}catch{throw fail(400,'INVALID_INPUT');}}
  if(typeof body==='string')body=JSON.parse(body);
  if(req.method==='PUT'){
   if(!body || Object.keys(body).sort().join(',')!=='expectedRevision,time,weekday' || !Number.isSafeInteger(body.expectedRevision))throw fail(400,'INVALID_INPUT');
   try{nextWeeklyTime(clock.simulated_at,body.weekday,body.time);}catch{throw fail(400,'INVALID_SCHEDULE');}
   const updated=check(await db.rpc('save_weekly_schedule',{p_family:member.family_id,p_parent:member.user_id,p_expected:body.expectedRevision,p_weekday:body.weekday,p_time:body.time}));
   if(!updated)throw fail(409,'CLOCK_CHANGED');return send(200,{saved:true});
  }
  if(path!=='/api/demo/advance' || !body || Object.keys(body).join(',')!=='expectedRevision' || !Number.isSafeInteger(body.expectedRevision))throw fail(400,'INVALID_INPUT');
  const key=req.headers['idempotency-key'];if(!uuid.test(key??''))throw fail(400,'INVALID_INPUT');
  const chain=ledger(),rules=await readFamilyRules(db,member.family_id);
  let e=check(await events().select('*').eq('id',key).eq('family_id',member.family_id).maybeSingle());
  if(!e){
   if(clock.weekday===null)throw fail(409,'SCHEDULE_REQUIRED');
   const admitted=await db.rpc('start_weekly_event',{p_id:key,p_family:member.family_id,p_parent:member.user_id,p_revision:body.expectedRevision,p_target:nextWeeklyTime(clock.simulated_at,clock.weekday,clock.local_time),p_rules:rules.revision});
   if(admitted.error)throw fail(409,admitted.error.message.includes('PENDING')?'MONEY_OPERATION_PENDING':'CLOCK_CHANGED');e=admitted.data;
  }
  if(['confirmed','allocation_skipped'].includes(e.status))return send(200,projection(e));
  if(e.stage<6){
   const stage=WEEKLY_STAGES[e.stage];
   if(e.stage_started){
    const step=e.steps[stage];if(!step || (await chain.status(step.hash)).status!=='SUCCESS')return send(202,projection(e));
   }else{
    const admitted=check(await events().update({stage_started:true}).eq('id',e.id).eq('stage',e.stage).eq('stage_started',false).select('*').maybeSingle());
    if(!admitted)return send(202,projection(e));e=admitted;
    try{
     const step=await chain.prepare(stage,e);
     if(step){e.steps={...e.steps,[stage]:step};check(await events().update({steps:e.steps}).eq('id',e.id));await chain.submit(step.signed);if((await chain.status(step.hash)).status!=='SUCCESS')throw Error('UNKNOWN');}
    }catch{check(await events().update({status:'unknown'}).eq('id',e.id));e.status='unknown';return send(202,projection(e));}
   }
   check(await events().update({stage:e.stage+1,stage_started:false,status:'processing'}).eq('id',e.id).eq('stage',e.stage));e.stage++;e.stage_started=false;e.status='processing';
   return send(202,projection(e));
  }
  // Reuse the existing allocation journal. Same event UUID always means the same allocation.
  const prior=check(await db.from('needs_funding').select('id,status').eq('parent_id',member.user_id).eq('request_key',e.id).maybeSingle());
  if(!prior && !await chain.verify(e))throw fail(409,'BACKING_MISMATCH');
  if(!prior && rules.revision!==e.rules_revision)throw fail(409,'RULES_CHANGED');
  if(!prior && await chain.spendable()<BigInt(phpToStroops(rules.settings.weeklyAmountMinor))+600000000n){
   check(await db.rpc('finish_weekly_event',{p_id:e.id,p_skipped:true}));e.status='allocation_skipped';e.notice='Next allowance skipped: insufficient parent funding.';return send(200,projection(e));
  }
  let result;
  await funding({method:'POST',url:'/api/allowance-funding',headers:{'idempotency-key':e.id},body:{expectedRevision:e.rules_revision}},{setHeader(){},set statusCode(v){},end(v){result=JSON.parse(v);}},{authenticate:async()=>({member}),database});
  if(result?.status==='confirmed'){check(await db.rpc('finish_weekly_event',{p_id:e.id,p_skipped:false}));e.status='confirmed';}
  return send(e.status==='confirmed'?200:202,projection(e));
 }catch(e){send(e.status??503,{error:{code:e.code??'WEEKLY_UNAVAILABLE',message:e.code??'Weekly service unavailable.',retryable:false}});}
}
