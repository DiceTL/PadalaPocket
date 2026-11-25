import { createClient } from '@supabase/supabase-js';
import { Velo } from '@carts1024/velo-sdk';
import { Keypair } from '@stellar/stellar-sdk';
import { operatorPayer, verifyVeloReceipt } from './velo-receipts.mjs';
import { authenticateMember } from './identity.mjs';
import { readFamilyRules } from './family.mjs';
import { phpToStroops } from './money-mapping.mjs';
const fail=(status,code)=>Object.assign(Error(code),{status,code});
const uuid=/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const states=['awaiting_route','created','pending','paid','failed','expired','cancelled'];
const admissionErrors={
 FORBIDDEN:[403,'Only the family parent can start a deposit.'],
 DEPOSIT_MINIMUM:[400,'Enter at least ₱10 for a simulated deposit.'],
 DEPOSIT_CAP_EXCEEDED:[409,'This deposit would exceed the ₱5,000 lifetime family limit.'],
 TOPUP_PENDING:[409,'Resolve the pending deposit before starting another.'],
 RULES_CHANGED:[409,'Refresh the saved family rules before starting a deposit.'],
 IDEMPOTENCY_CONFLICT:[409,'This request key is already bound to a different deposit.'],
};
const cancellationErrors={
 FORBIDDEN:[403,'Only the family parent can cancel a deposit.'],
 NOT_FOUND:[404,'Deposit not found.'],
 CREDIT_STARTED:[409,'A credit transfer has already started for this deposit.'],
 CONFIRMED:[409,'This deposit is already confirmed and cannot be cancelled.'],
 PAYMENT_STARTED:[409,'Payment has started; wait for reconciliation.'],
 STATUS_UNKNOWN:[409,'This deposit has an unknown status; reconcile it before cancelling.'],
 NOT_CANCELLABLE:[409,'This deposit can no longer be cancelled.'],
 INVALID_INPUT:[400,'Invalid deposit cancellation request.'],
};
const knownErrors={...cancellationErrors,...admissionErrors};
export const xlmAmount=value=>{const n=BigInt(value);return `${n/10000000n}.${(n%10000000n).toString().padStart(7,'0')}`;};
const intentWindow=intent=>{const from=Date.parse(intent?.createdAt),until=Date.parse(intent?.expiresAt);
 return Number.isFinite(from)&&Number.isFinite(until)&&until>from?{intent_created_at:new Date(from).toISOString(),intent_expires_at:new Date(until).toISOString()}:null;};
export function validateIntent(intent,row){
 if(!intent||! /^[a-z0-9]{20,64}$/i.test(intent.paymentIntentId??'')||intent.asset!=='native'||!/^\d+(\.\d{1,7})?$/.test(intent.amount??'')||!states.includes(intent.status))throw fail(503,'INVALID_VELO_RESPONSE');
 const [whole,fraction='']=intent.amount.split('.');
 if(BigInt(whole)*10000000n+BigInt(fraction.padEnd(7,'0'))!==BigInt(row.amount_stroops)||row.intent_id&&row.intent_id!==intent.paymentIntentId)throw fail(503,'INVALID_VELO_RESPONSE');
 // An explicit deposit is bound to its checkout window; a receipt cannot be
 // attributed without knowing which intent lifetime the payment falls in.
 if(row.amount_minor!=null&&!intentWindow(intent))throw fail(503,'INVALID_VELO_RESPONSE');
 if(intent.receiverAddress!==row.expected_receiver)return {intent_id:intent.paymentIntentId,status:'configuration_required',checkout_url:null};
 let url=null;
 if(intent.checkoutUrl){const parsed=new URL(intent.checkoutUrl);if(parsed.origin!=='https://www.velo-build.dev'||parsed.username||parsed.password)throw fail(503,'INVALID_VELO_RESPONSE');url=parsed.href;}
 return {intent_id:intent.paymentIntentId,status:intent.status,checkout_url:url};
}
export async function veloTopups(req,res,{authenticate=authenticateMember,database=createClient,provider=()=>new Velo({apiKey:process.env.VELO_API_KEY,baseUrl:'https://www.velo-build.dev',environment:'testnet',timeoutMs:15000,maxRetries:0}),receiver=()=>Keypair.fromPublicKey(process.env.OWNER_PUBLIC_KEY).publicKey(),loadRules=readFamilyRules,verifyReceipt=verifyVeloReceipt,operator=operatorPayer,horizon=fetch,receiptRetryMs=60000}={}){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 const send=(code,body)=>{res.statusCode=code;res.end(JSON.stringify(body));};
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'METHOD_NOT_ALLOWED');
  const {member}=await authenticate(req);if(member.role!=='parent')throw fail(403,'FORBIDDEN');
  const db=database(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const table=()=>db.from('velo_topups');let client;const velo=()=>client??=provider();
  // T14/DEC-139: a candidate belongs to this deposit only when its hash is unbound
  // and its payment time is outside every other unbound explicit intent window.
  const claimableCandidate=async(candidate,depositId)=>{
   const hash=candidate?.txHash;
   if(typeof hash!=='string'||!/^[a-f0-9]{64}$/i.test(hash))return false;
   const {data,error}=await table().select('id').eq('tx_hash',hash).neq('id',depositId).limit(1);
   if(error)throw fail(503,'DATABASE_UNAVAILABLE');
   if((data??[]).length>0)return false;
   const at=candidate.createdAt;
   if(!Number.isFinite(Date.parse(at)))return false;
   // Only a still-possible checkout for the same exact amount can claim a
   // payment; a different amount can never match. A deposit whose intent was
   // proven dead (resolved/terminal) cannot own one, so its old window is not a
   // fence; `paid` and `unknown` rows remain possible claimants.
   const {data:overlap,error:overlapError}=await table().select('id').neq('id',depositId)
    .not('amount_minor','is',null).is('tx_hash',null).neq('verification_status','verified')
    .not('status','in','(failed,expired,cancelled)').neq('cancellation_state','resolved')
    .eq('amount_stroops',candidate.amountStroops)
    .lte('intent_created_at',at).gte('intent_expires_at',at).limit(1);
   if(overlapError)throw fail(503,'DATABASE_UNAVAILABLE');
   return (overlap??[]).length===0;
  };
  const receiptDue=row=>!row.verification_checked_at||Date.now()-Date.parse(row.verification_checked_at)>=receiptRetryMs;
  const creditView=(row,credit)=>{
   if(row.amount_minor==null)return {};
   const creditStatus=row.cancelled_at?'cancelled':credit?.creditStatus??(row.verification_status==='verified'?'awaiting_credit':'unverified');
   return {creditStatus,spendable:creditStatus==='confirmed'&&!row.cancelled_at,
    ...(credit?.operationId&&{creditOperationId:credit.operationId}),
    ...(creditStatus==='confirmed'&&credit?.transactionHash&&{creditTxHash:credit.transactionHash}),
    ...(creditStatus==='confirmed'&&credit.confirmedLedger!=null&&{creditLedger:String(credit.confirmedLedger)})};
  };
  // DEC-139: only legacy deposits expose a payable link. An explicit deposit is
  // paid by the pinned operator from operator-side tooling, so the parent is not
  // shown a payment that cannot be credited.
  const project=(row,credit)=>({id:row.id,status:row.cancelled_at?'cancelled':row.status,amountXlm:xlmAmount(row.amount_stroops),expectedReceiver:row.expected_receiver,checkoutUrl:row.amount_minor==null?row.checkout_url:null,intentId:row.intent_id,createdAt:row.created_at,
   ...(row.amount_minor!=null&&{amountMinor:String(row.amount_minor),mappingVersion:row.mapping_version,simulated:true,verificationStatus:row.verification_status??'unverified',
     ...(row.tx_hash&&{txHash:row.tx_hash}),...(row.verified_at&&{verifiedAt:row.verified_at}),...(row.verified_ledger!=null&&{verifiedLedger:String(row.verified_ledger)})}),
   ...creditView(row,credit),
   ...(row.cancelled_at&&{cancelledAt:row.cancelled_at}),
   ...(row.cancellation_state&&row.cancellation_state!=='none'&&{cancellationState:row.cancellation_state})});
  async function update(row,patch){const {error}=await table().update(patch).eq('id',row.id).eq('parent_id',member.user_id);if(error)throw fail(503,'DATABASE_UNAVAILABLE');Object.assign(row,patch);}
  async function saveIntent(row,intent){
   const id=intent?.paymentIntentId;
   if(!/^[a-z0-9]{20,64}$/i.test(id??''))return false;
   const window=intentWindow(intent);
   const {data,error}=await table().update({intent_id:id,...(window??{})}).eq('id',row.id).eq('parent_id',member.user_id).is('intent_id',null).select('*').maybeSingle();
   if(error)throw fail(503,'DATABASE_UNAVAILABLE');
   if(data){Object.assign(row,data);return true;}
   const {data:fresh,error:freshError}=await table().select('*').eq('id',row.id).eq('parent_id',member.user_id).single();
   if(freshError||!fresh)throw fail(503,'DATABASE_UNAVAILABLE');
   Object.assign(row,fresh);
   return false;
  }
  async function storeReceipt(row,receipt){
   if(row.amount_minor==null||row.verification_status==='verified'||!receipt||receipt.status==='unverified')return;
   const patch=receipt.status==='verified'
    ?{verification_status:'verified',tx_hash:receipt.txHash,payer_address:receipt.payerAddress,verified_at:receipt.verifiedAt,verified_ledger:receipt.ledger,verification_checked_at:new Date().toISOString()}
    :{verification_status:receipt.status,tx_hash:null,payer_address:null,verified_at:null,verified_ledger:null,verification_checked_at:new Date().toISOString()};
   const {data,error}=await table().update(patch).eq('id',row.id).eq('parent_id',member.user_id).is('tx_hash',null).select('*').maybeSingle();
   if(error){
    if(error.code==='23505'&&receipt.status==='verified'){await update(row,{verification_status:'mismatch'});return;}
    throw fail(503,'DATABASE_UNAVAILABLE');
   }
   if(data){Object.assign(row,data);return;}
   const {data:fresh,error:freshError}=await table().select('*').eq('id',row.id).eq('parent_id',member.user_id).single();
   if(freshError||!fresh)throw fail(503,'DATABASE_UNAVAILABLE');
   Object.assign(row,fresh);
  }
  async function reconcileCancellation(row){
   if(!['fenced','late_paid'].includes(row.cancellation_state))return;
   if(row.cancellation_state==='late_paid'&&!receiptDue(row))return;
   if(!row.intent_id){await update(row,{status:'cancelled',checkout_url:null,cancellation_state:'resolved',cancellation_checked_at:new Date().toISOString()});return;}
   let intent,observed;
   try{intent=await velo().paymentIntents.retrieve(row.intent_id);observed=validateIntent(intent,row);}catch{return;}
   if(observed.status==='paid'){
    const checked=new Date().toISOString();
    if(row.amount_minor!=null&&row.verification_status!=='verified'){
     let receipt;try{receipt=await verifyReceipt(row,intent,{payer:operator(),horizon,isCandidateClaimable:candidate=>claimableCandidate(candidate,row.id)});}catch{receipt={status:'unavailable'};}
     await storeReceipt(row,receipt);
    }
    // DEC-140: a verified late payment wins. The failed cancellation is
    // superseded so the existing T15 credit path can complete exactly once;
    // an unverifiable late payment stays fenced and blocks admission.
    if(row.amount_minor!=null&&row.verification_status==='verified'){
     await update(row,{status:'paid',checkout_url:null,cancelled_at:null,cancellation_state:'superseded',cancellation_checked_at:checked});
     return;
    }
    await update(row,{cancellation_state:'late_paid',checkout_url:null,cancellation_checked_at:checked});
    return;
   }
   if(['failed','expired','cancelled'].includes(observed.status)){
    await update(row,{status:'cancelled',checkout_url:null,cancellation_state:'resolved',cancellation_checked_at:new Date().toISOString()});
    return;
   }
   await update(row,{cancellation_checked_at:new Date().toISOString()});
  }
  async function observe(row){
   if(row.cancelled_at){await reconcileCancellation(row);return;}
   if(!row.intent_id)return;
   const intent=await velo().paymentIntents.retrieve(row.intent_id);
   const window=intentWindow(intent);
   await update(row,validateIntent(intent,row));
   if(row.amount_minor!=null&&row.intent_created_at==null&&window)await update(row,window);
   if(row.amount_minor!=null&&row.status==='paid'&&row.verification_status!=='verified'&&receiptDue(row)){
    let receipt;
    try{receipt=await verifyReceipt(row,intent,{payer:operator(),horizon,isCandidateClaimable:candidate=>claimableCandidate(candidate,row.id)});}catch{receipt={status:'unavailable'};}
    await storeReceipt(row,receipt);
   }
  }
  async function createCheckout(row){
   if(row.cancelled_at){await reconcileCancellation(row);return;}
   if(row.intent_id){await observe(row);return;}
   if(['paid','unknown','failed','expired','cancelled','configuration_required'].includes(row.status))return;
   try{
    const intent=await velo().checkout.sessions.create({amount:xlmAmount(row.amount_stroops),asset:'native',description:row.amount_minor!=null?'PadalaPocket simulated deposit — Testnet':'PadalaPocket parent allowance wallet — Testnet'},{idempotencyKey:`padalapocket-topup:${row.id}`,correlationId:row.id});
    if(!/^[a-z0-9]{20,64}$/i.test(intent?.paymentIntentId??'')){await update(row,{status:'unknown',checkout_url:null});return;}
    // Validate before attaching so a malformed intent/window is never stored.
    const observed=validateIntent(intent,row);
    // Only the first checkout identity may attach. A concurrent replay observes it instead of overwriting.
    if(!await saveIntent(row,intent)){await observe(row);return;}
    await update(row,observed);
   }catch{if(!['paid','failed','expired','cancelled','configuration_required'].includes(row.status))await update(row,{status:'unknown',checkout_url:null});}
  }
  if(req.method==='GET'){
   const {data,error}=await table().select('*').eq('parent_id',member.user_id).eq('family_id',member.family_id).order('created_at',{ascending:false}).limit(30);if(error)throw fail(503,'DATABASE_UNAVAILABLE');
   for(const row of data){try{await observe(row);}catch{if(!row.cancelled_at&&!['configuration_required','paid','failed','expired','cancelled'].includes(row.status))row.status='status_unavailable';row.checkout_url=null;}}
   const {data:balance,error:balanceError}=await db.rpc('read_parent_balance',{p_family:member.family_id,p_parent:member.user_id});
   if(balanceError)throw fail(503,'DATABASE_UNAVAILABLE');
   if(!balance)throw fail(403,'FORBIDDEN');
   const credits=new Map((balance.deposits??[]).map(item=>[item.depositId,item]));
   return send(200,{topups:data.map(row=>project(row,credits.get(row.id))),expectedReceiver:receiver(),parentBalance:{confirmedDepositStroops:balance.confirmedDepositStroops,pendingDepositStroops:balance.pendingDepositStroops,confirmedAllocationStroops:balance.confirmedAllocationStroops,pendingAllocationStroops:balance.pendingAllocationStroops,confirmedHoldingsStroops:balance.confirmedHoldingsStroops,availableStroops:balance.availableStroops,basis:balance.basis}});
  }
  const key=req.headers['idempotency-key'];if(!uuid.test(key??''))throw fail(400,'INVALID_INPUT');
  let body=req.body;if(body===undefined){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>1024)throw fail(400,'INVALID_INPUT');}try{body=JSON.parse(raw);}catch{throw fail(400,'INVALID_INPUT');}}
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw fail(400,'INVALID_INPUT');}}
  const fields=body&&typeof body==='object'&&!Array.isArray(body)?Object.keys(body).sort().join(','):'';
  const explicit=fields==='amountMinor,expectedRevision';
  if(fields==='cancelId'){
   if(!uuid.test(body.cancelId??''))throw fail(400,'INVALID_INPUT');
   const {error}=await db.rpc('cancel_velo_deposit',{p_family:member.family_id,p_parent:member.user_id,p_deposit:body.cancelId});
   if(error){
    const known=error.code==='P0001'&&Object.hasOwn(cancellationErrors,error.message);
    throw known?fail(cancellationErrors[error.message][0],error.message):fail(503,'DATABASE_UNAVAILABLE');
   }
   const {data:row,error:readError}=await table().select('*').eq('id',body.cancelId).eq('parent_id',member.user_id).eq('family_id',member.family_id).single();
   if(readError||!row)throw fail(503,'DATABASE_UNAVAILABLE');
   return send(200,project(row));
  }
  if((!explicit&&fields!=='expectedRevision')||!Number.isSafeInteger(body.expectedRevision)||body.expectedRevision<0)throw fail(400,'INVALID_INPUT');
  if(explicit){
   if(typeof body.amountMinor!=='string'||!/^(0|[1-9][0-9]{0,8})$/.test(body.amountMinor))throw fail(400,'INVALID_INPUT');
   const {data,error}=await db.rpc('admit_velo_deposit',{p_family:member.family_id,p_parent:member.user_id,p_key:key,
    p_revision:body.expectedRevision,p_amount_minor:Number(body.amountMinor),p_receiver:receiver()});
   if(error){
    const known=error.code==='P0001'&&Object.hasOwn(admissionErrors,error.message);
    throw known?fail(admissionErrors[error.message][0],error.message):fail(503,'DATABASE_UNAVAILABLE');
   }
   const row=data.deposit;
   await createCheckout(row);
   return send(data.created?201:200,project(row));
  }
  const findPrevious=()=>table().select('*').eq('parent_id',member.user_id).eq('family_id',member.family_id).eq('request_key',key).maybeSingle();
  async function replay(row){
   if(row.amount_minor!=null||Number(row.rules_revision)!==body.expectedRevision)throw fail(409,'IDEMPOTENCY_CONFLICT');
   await observe(row);return send(200,project(row));
  }
  const previous=await findPrevious();if(previous.error)throw fail(503,'DATABASE_UNAVAILABLE');
  if(previous.data)return await replay(previous.data);
  const rules=await loadRules(db,member.family_id);if(rules.revision!==body.expectedRevision)throw fail(409,'RULES_CHANGED');
  const inserted=await table().insert({family_id:member.family_id,parent_id:member.user_id,request_key:key,rules_revision:rules.revision,amount_stroops:phpToStroops(rules.settings.weeklyAmountMinor),expected_receiver:receiver()}).select('*').single();
  if(inserted.error){
   if(inserted.error.code!=='23505')throw fail(503,'DATABASE_UNAVAILABLE');
   const concurrent=await findPrevious();if(concurrent.error)throw fail(503,'DATABASE_UNAVAILABLE');
   if(concurrent.data)return await replay(concurrent.data);
   throw fail(409,'TOPUP_PENDING');
  }
  const row=inserted.data;
  await createCheckout(row);
  return send(201,project(row));
 }catch(error){const known=Object.hasOwn(knownErrors,error.code)?knownErrors[error.code][1]:null;send(error.status??503,{error:{code:error.code??'VELO_UNAVAILABLE',message:known??error.code??'Velo is unavailable. Refresh status before trying again.',retryable:false}});}
}
