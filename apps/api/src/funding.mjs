import { readFamilyRules } from './family.mjs';
import { createClient } from '@supabase/supabase-js';
import { Asset, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { NoirAgentClient, keypairSigner } from '@noirx402/agent-sdk';
import { createHash } from 'node:crypto';
import { authenticateMember } from './identity.mjs';
import { phpToStroops, splitAllowance, MONEY_MAPPING } from './money-mapping.mjs';
const err = (status, code) => Object.assign(new Error(code), {status, code});
const amount = phpToStroops('968');
export async function funding(req,res, { authenticate = authenticateMember, database = createClient, ledger = () => new NoirAgentClient({network:'testnet'}) } = {}) {
 res.setHeader('Content-Type','application/json'); res.setHeader('Cache-Control','no-store');
 const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
 try {
  if(!['GET','POST'].includes(req.method)) throw err(405,'METHOD_NOT_ALLOWED');
  const {member}=await authenticate(req);
  if(member.role!=='parent') throw err(403,'FORBIDDEN');
  const db=database(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const noir=ledger(); noir.server.httpClient.defaults.timeout=15000;
  const distribution=new URL(req.url??'/api/needs-funding','http://localhost').pathname==='/api/allowance-funding';
  const deviceHash=createHash('sha256').update('PadalaPocket Needs '+member.family_id).digest('hex');
  const asset=Asset.native().contractId(Networks.TESTNET);
  const query=()=>db.from('needs_funding');
  const save=async(row,patch)=>{const {error}=await query().update(patch).eq('id',row.id);if(error)throw err(503,'PROVIDER_UNAVAILABLE');Object.assign(row,patch);};
  const project=row=>({id:row.id,status:row.status,priceMinor:row.price_minor,amountStroops:row.amount_stroops,mappingVersion:row.mapping_version,transactionHash:row.steps.fund?.hash??null,escrowStroops:row.escrow_stroops,createdAt:row.created_at,wantsStroops:row.wants_stroops??'0',totalStroops:row.total_stroops??row.amount_stroops,wantsTransactionHash:row.steps.wantsFund?.hash??null});
  async function reconcile(row) {
   if(row.status==='confirmed'||row.status==='failed') return;
   const required = BigInt(row.wants_stroops??'0')>0n ? ['fund','wantsFund'].filter(n=>n!=='fund'||BigInt(row.amount_stroops)>0n) : ['fund'];
   for(const name of required){
    if(!row.steps[name]?.hash)return;
    const result=await noir.server.getTransaction(row.steps[name].hash);
    if(result.status==='FAILED'&&row.rules_revision==null){await save(row,{status:'failed'});return;}
    if(result.status!=='SUCCESS')return;
   }
   const needs=BigInt(row.amount_stroops)>0n?await noir.getEscrowBalance(row.device_hash):0n;
   const wants=BigInt(row.wants_stroops??'0')>0n?await noir.getEscrowBalance(row.wants_device_hash):0n;
   if(needs<BigInt(row.amount_stroops)||wants<BigInt(row.wants_stroops??'0'))throw Error('BACKING_MISMATCH');
   await save(row,{status:'confirmed',escrow_stroops:needs.toString()});
  }
  if(req.method==='GET') {
   const {data,error}=await query().select('*').eq('family_id',member.family_id).order('created_at',{ascending:false});
   if(error)throw err(503,'PROVIDER_UNAVAILABLE');
   for(const row of data)await reconcile(row);
   return send(200,{operations:data.map(project),confirmedNeedsStroops:data.filter(r=>r.status==='confirmed').reduce((a,r)=>a+BigInt(r.amount_stroops),0n).toString(),confirmedWantsStroops:data.filter(r=>r.status==='confirmed').reduce((a,r)=>a+BigInt(r.wants_stroops??'0'),0n).toString(),fundingPriceMinor:'968',fundingAmountStroops:amount});
  }
  const key=req.headers['idempotency-key'];
  if(!/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(key??''))throw err(400,'INVALID_INPUT');
  let body=req.body;
  if(body===undefined){let raw='';for await(const c of req){raw+=c;if(Buffer.byteLength(raw)>1024)throw err(400,'INVALID_INPUT');}try{body=JSON.parse(raw);}catch{throw err(400,'INVALID_INPUT');}}
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw err(400,'INVALID_INPUT');}}
  if(!body||Object.keys(body).length!==1||(distribution?!Number.isSafeInteger(body.expectedRevision):body.priceMinor!=='968'))throw err(409,'IDEMPOTENCY_CONFLICT');
  const prior=await query().select('*').eq('parent_id',member.user_id).eq('request_key',key).maybeSingle();
  if(prior.error)throw err(503,'PROVIDER_UNAVAILABLE');
  if(prior.data){if(distribution?(prior.data.rules_revision!==body.expectedRevision):prior.data.rules_revision!=null)throw err(409,'IDEMPOTENCY_CONFLICT');await reconcile(prior.data);return send(200,project(prior.data));}
  const settings=distribution?await readFamilyRules(db,member.family_id):null;
  if(distribution&&settings.revision!==body.expectedRevision)throw err(409,'RULES_CHANGED');
  const total=distribution?phpToStroops(settings.settings.weeklyAmountMinor):amount;
  const split=distribution?splitAllowance(total,settings.settings.needsPercent):{needs:amount,wants:'0'};
  const wantsDevice=createHash('sha256').update('PadalaPocket Wants '+member.family_id).digest('hex');
  const inserted=await query().insert({family_id:member.family_id,parent_id:member.user_id,request_key:key,price_minor:distribution?settings.settings.weeklyAmountMinor:'968',amount_stroops:split.needs,wants_stroops:split.wants,total_stroops:total,wants_device_hash:wantsDevice,rules_revision:settings?.revision??null,mapping_version:MONEY_MAPPING.version,device_hash:deviceHash}).select('*').single();
  if(inserted.error){if(inserted.error.code==='23505'){const replay=await query().select('*').eq('parent_id',member.user_id).eq('request_key',key).maybeSingle();if(replay.data){if(distribution?(replay.data.rules_revision!==body.expectedRevision):replay.data.rules_revision!=null)throw err(409,'IDEMPOTENCY_CONFLICT');return send(200,project(replay.data));}throw err(409,'FUNDING_PENDING');}throw err(503,'PROVIDER_UNAVAILABLE');}
  const row=inserted.data;
  try {
   const owner=keypairSigner(process.env.OWNER_SECRET), agent=keypairSigner(process.env.AGENT_SECRET);
   const operations=[];
   for(const [bucket,target,quantity] of [['',deviceHash,split.needs],['wants',wantsDevice,split.wants]]){
    if(BigInt(quantity)===0n)continue;
    const deviceOwner=await noir.getDeviceOwner(target);
    if(!deviceOwner)operations.push([bucket?'wantsDevice':'device',{kind:'registerDevice',deviceHash:target,agent:agent.publicKey}]);
    else if(deviceOwner!==owner.publicKey)throw Error('OWNER_MISMATCH');
    operations.push([bucket?'wantsFund':'fund',{kind:'fundEscrow',deviceHash:target,token:asset,amount:BigInt(quantity)}]);
   }
   for(const [name,op] of operations){
    const unsigned=await noir.prepare(owner.publicKey,op);
    const signed=await owner.signTransaction(unsigned,{networkPassphrase:Networks.TESTNET});
    const tx=TransactionBuilder.fromXDR(signed,Networks.TESTNET);
    if(BigInt(tx.fee)>300000000n)throw Error('FEE_LIMIT');
    const [accountResponse,ledgerResponse]=await Promise.all([fetch(`https://horizon-testnet.stellar.org/accounts/${owner.publicKey}`, {signal:AbortSignal.timeout(15000)}),fetch('https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1', {signal:AbortSignal.timeout(15000)})]);
    if(!accountResponse.ok||!ledgerResponse.ok)throw Error('RESERVE_UNAVAILABLE');
    const account=await accountResponse.json(),ledger=(await ledgerResponse.json())._embedded.records[0];
    const native=account.balances.find(b=>b.asset_type==='native');
    const stroops=v=>BigInt(v.replace('.',''));
    const reserve=BigInt(2+account.subentry_count+(account.num_sponsoring??0)-(account.num_sponsored??0))*BigInt(ledger.base_reserve_in_stroops);
    if(operations[0][0]===name && stroops(native.balance)-stroops(native.selling_liabilities)-reserve-BigInt(total)-300000000n*BigInt(operations.length)<0n)throw Error('INSUFFICIENT_FUNDS');
    if(stroops(native.balance)-stroops(native.selling_liabilities)-reserve-BigInt(tx.fee)<(op.kind==='fundEscrow'?op.amount:0n))throw Error('INSUFFICIENT_FUNDS');
    row.steps[name]={hash:tx.hash().toString('hex'),signed};
    await save(row,{steps:row.steps}); // durable envelope BEFORE network dispatch
    await noir.submit(signed,op);
    const result=await noir.server.getTransaction(row.steps[name].hash);
    if(result.status!=='SUCCESS')throw Error('UNKNOWN');
   }
   await reconcile(row);
  } catch {await save(row,{status:'unknown'});}
  return send(row.status==='confirmed'?201:202,project(row));
 }catch(e){send(e.status??503,{error:{code:e.code??'PROVIDER_UNAVAILABLE',message:e.status?e.code:'Funding service unavailable.',retryable:!e.status||e.status>=500}});}
}
