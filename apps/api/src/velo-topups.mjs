import { createClient } from '@supabase/supabase-js';
import { Velo } from '@carts1024/velo-sdk';
import { Keypair } from '@stellar/stellar-sdk';
import { authenticateMember } from './identity.mjs';
import { readFamilyRules } from './family.mjs';
import { phpToStroops } from './money-mapping.mjs';
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const states=['awaiting_route','created','pending','paid','failed','expired','cancelled'];
export const xlmAmount=value=>{const n=BigInt(value);return `${n/10000000n}.${(n%10000000n).toString().padStart(7,'0')}`;};
export function validateIntent(intent,row){
 if(!intent||! /^[a-z0-9]{20,64}$/i.test(intent.paymentIntentId??'')||intent.asset!=='native'||!/^\d+(\.\d{1,7})?$/.test(intent.amount??'')||!states.includes(intent.status))throw fail(503,'INVALID_VELO_RESPONSE');
 const [whole,fraction='']=intent.amount.split('.');
 if(BigInt(whole)*10000000n+BigInt(fraction.padEnd(7,'0'))!==BigInt(row.amount_stroops)||row.intent_id&&row.intent_id!==intent.paymentIntentId)throw fail(503,'INVALID_VELO_RESPONSE');
 if(intent.receiverAddress!==row.expected_receiver)return {intent_id:intent.paymentIntentId,status:'configuration_required',checkout_url:null};
 let url=null;
 if(intent.checkoutUrl){const parsed=new URL(intent.checkoutUrl);if(parsed.origin!=='https://www.velo-build.dev'||parsed.username||parsed.password)throw fail(503,'INVALID_VELO_RESPONSE');url=parsed.href;}
 return {intent_id:intent.paymentIntentId,status:intent.status,checkout_url:url};
}
export async function veloTopups(req,res,{authenticate=authenticateMember,database=createClient,provider=()=>new Velo({apiKey:process.env.VELO_API_KEY,baseUrl:'https://www.velo-build.dev',environment:'testnet',timeoutMs:15000,maxRetries:0}),receiver=()=>Keypair.fromSecret(process.env.OWNER_SECRET).publicKey(),loadRules=readFamilyRules}={}){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 const send=(code,body)=>{res.statusCode=code;res.end(JSON.stringify(body));};
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'METHOD_NOT_ALLOWED');
  const {member}=await authenticate(req);if(member.role!=='parent')throw fail(403,'FORBIDDEN');
  const db=database(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const table=()=>db.from('velo_topups');let client;const velo=()=>client??=provider();
  const project=row=>({id:row.id,status:row.status,amountXlm:xlmAmount(row.amount_stroops),expectedReceiver:row.expected_receiver,checkoutUrl:row.checkout_url,intentId:row.intent_id,createdAt:row.created_at});
  async function update(row,patch){const {error}=await table().update(patch).eq('id',row.id).eq('parent_id',member.user_id);if(error)throw fail(503,'DATABASE_UNAVAILABLE');Object.assign(row,patch);}
  async function observe(row){if(!row.intent_id)return;const intent=await velo().paymentIntents.retrieve(row.intent_id);await update(row,validateIntent(intent,row));}
  if(req.method==='GET'){
   const {data,error}=await table().select('*').eq('parent_id',member.user_id).eq('family_id',member.family_id).order('created_at',{ascending:false}).limit(30);if(error)throw fail(503,'DATABASE_UNAVAILABLE');
   for(const row of data){try{await observe(row);}catch{if(!['configuration_required','paid','failed','expired','cancelled'].includes(row.status))row.status='status_unavailable';row.checkout_url=null;}}
   return send(200,{topups:data.map(project),expectedReceiver:receiver()});
  }
  const key=req.headers['idempotency-key'];if(!uuid.test(key??''))throw fail(400,'INVALID_INPUT');
  let body=req.body;if(body===undefined){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>1024)throw fail(400,'INVALID_INPUT');}try{body=JSON.parse(raw);}catch{throw fail(400,'INVALID_INPUT');}}
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw fail(400,'INVALID_INPUT');}}
  if(!body||Object.keys(body).join(',')!=='expectedRevision'||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw fail(400,'INVALID_INPUT');
  const previous=await table().select('*').eq('parent_id',member.user_id).eq('family_id',member.family_id).eq('request_key',key).maybeSingle();if(previous.error)throw fail(503,'DATABASE_UNAVAILABLE');
  if(previous.data){if(Number(previous.data.rules_revision)!==body.expectedRevision)throw fail(409,'IDEMPOTENCY_CONFLICT');await observe(previous.data);return send(200,project(previous.data));}
  const rules=await loadRules(db,member.family_id);if(rules.revision!==body.expectedRevision)throw fail(409,'RULES_CHANGED');
  const inserted=await table().insert({family_id:member.family_id,parent_id:member.user_id,request_key:key,rules_revision:rules.revision,amount_stroops:phpToStroops(rules.settings.weeklyAmountMinor),expected_receiver:receiver()}).select('*').single();
  if(inserted.error)throw fail(inserted.error.code==='23505'?409:503,inserted.error.code==='23505'?'TOPUP_PENDING':'DATABASE_UNAVAILABLE');
  const row=inserted.data;
  try{const intent=await velo().checkout.sessions.create({amount:xlmAmount(row.amount_stroops),asset:'native',description:'PadalaPocket parent allowance wallet — Testnet'},{idempotencyKey:`padalapocket-topup:${row.id}`,correlationId:row.id});
   // Keep the returned identity even if validation/configuration fails: never recreate it.
   if(/^[a-z0-9]{20,64}$/i.test(intent?.paymentIntentId??''))await update(row,{intent_id:intent.paymentIntentId});
   await update(row,validateIntent(intent,row));
  }catch{await update(row,{status:'unknown',checkout_url:null});}
  return send(201,project(row));
 }catch(error){send(error.status??503,{error:{code:error.code??'VELO_UNAVAILABLE',message:error.code??'Velo is unavailable. Refresh status before trying again.',retryable:false}});}
}
