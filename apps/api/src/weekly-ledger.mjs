import { Asset, Networks, TransactionBuilder } from '@stellar/stellar-sdk';
import { NoirAgentClient, keypairSigner } from '@noirx402/agent-sdk';
import { bucketDevice } from './weekly-plan.mjs';
export function weeklyLedger() {
 if(!process.env.STUDENT_SECRET) throw Error('STUDENT_SIGNER_REQUIRED');
 const noir=new NoirAgentClient({network:'testnet'});noir.server.httpClient.defaults.timeout=15000;
 const owner=keypairSigner(process.env.OWNER_SECRET),student=keypairSigner(process.env.STUDENT_SECRET);
 if([owner.publicKey,keypairSigner(process.env.AGENT_SECRET).publicKey,keypairSigner(process.env.MERCHANT_SECRET).publicKey].includes(student.publicKey))throw Error('DISTINCT_STUDENT_SIGNER_REQUIRED');
 const asset=Asset.native().contractId(Networks.TESTNET);
 async function spendable() {
  const responses=await Promise.all([fetch(`https://horizon-testnet.stellar.org/accounts/${owner.publicKey}`,{signal:AbortSignal.timeout(15000)}),fetch('https://horizon-testnet.stellar.org/ledgers?order=desc&limit=1',{signal:AbortSignal.timeout(15000)})]);
  if(responses.some(r=>!r.ok))throw Error('RESERVE_UNAVAILABLE');
  const account=await responses[0].json(),ledger=(await responses[1].json())._embedded.records[0];
  const native=account.balances.find(b=>b.asset_type==='native'),units=s=>BigInt(s.replace('.',''));
  return units(native.balance)-units(native.selling_liabilities)-BigInt(2+account.subentry_count+(account.num_sponsoring??0)-(account.num_sponsored??0))*BigInt(ledger.base_reserve_in_stroops);
 }
 return {
  spendable, status:hash=>noir.server.getTransaction(hash), submit:signed=>noir.submit(signed),
  async prepare(stage,event) {
   const devices=Object.fromEntries(['Needs','Wants','Savings','My Money'].map(b=>[b,bucketDevice(event.family_id,b)]));
   const n=BigInt(event.needs_stroops),w=BigInt(event.wants_stroops);
   let signer=owner,op;
   if(stage.endsWith('Device')){
    const mine=stage==='myMoneyDevice',target=devices[mine?'My Money':'Savings'];signer=mine?student:owner;
    const existing=await noir.getDeviceOwner(target);
    if(existing){if(existing!==signer.publicKey)throw Error('OWNER_MISMATCH');return null;}
    op={kind:'registerDevice',deviceHash:target,agent:signer.publicKey};
   }else{
    const config={needsDefund:['defundEscrow','Needs',n],wantsDefund:['defundEscrow','Wants',w],savingsFund:['fundEscrow','Savings',n],myMoneyFund:['fundEscrow','My Money',w]};
    const [kind,bucket,amount]=config[stage];if(amount===0n)return null;
    if(kind==='defundEscrow' && await noir.getEscrowBalance(devices[bucket])!==amount)throw Error('BACKING_MISMATCH');
    op={kind,deviceHash:devices[bucket],token:asset,amount};
   }
   const unsigned=await noir.prepare(signer.publicKey,op),signed=await signer.signTransaction(unsigned,{networkPassphrase:Networks.TESTNET});
   const tx=TransactionBuilder.fromXDR(signed,Networks.TESTNET);if(BigInt(tx.fee)>300000000n)throw Error('FEE_LIMIT');
   return {signed,hash:tx.hash().toString('hex')};
  },
  async verify(event){return await noir.getEscrowBalance(bucketDevice(event.family_id,'Needs'))===0n && await noir.getEscrowBalance(bucketDevice(event.family_id,'Wants'))===0n;},
 };
}
