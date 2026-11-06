// Read/replay existing funding only. Never creates a new funding request key.
import {createClient} from '@supabase/supabase-js';
import {NoirAgentClient} from '@noirx402/agent-sdk';
import {readFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.R001_BASE_URL, key=process.env.R002_REQUEST_KEY;
if(!base?.startsWith('https://')||!key)throw Error('Provide deployment origin and EXISTING request key.');
const {accounts}=JSON.parse(await readFile('.env.r001-accounts.json','utf8'));
let parentToken;
for(const account of accounts){
 const auth=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
 const {data,error}=await auth.auth.signInWithPassword({email:account.email,password:account.password});assert.equal(error,null);
 const response=await fetch(base+'/api/needs-funding',{headers:{authorization:`Bearer ${data.session.access_token}`}});
 if(account.role==='student')assert.equal(response.status,403);
 else {parentToken=data.session.access_token;assert.equal(response.status,200);}
}
const headers={authorization:`Bearer ${parentToken}`,'Content-Type':'application/json','Idempotency-Key':key};
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
const before=await db.from('needs_funding').select('id,device_hash,steps,status').eq('request_key',key).single();assert.equal(before.error,null);
const noir=new NoirAgentClient({network:'testnet'});
const balanceBefore=await noir.getEscrowBalance(before.data.device_hash);
const rows=await Promise.all([1,2].map(async()=>{const r=await fetch(base+'/api/needs-funding',{method:'POST',headers,body:JSON.stringify({priceMinor:'968'})});assert.equal(r.status,200);return r.json();}));
assert.equal(rows[0].id,before.data.id);assert.equal(rows[1].id,before.data.id);assert.equal(rows[0].transactionHash,rows[1].transactionHash);
assert.equal((await fetch(base+'/api/needs-funding',{method:'POST',headers,body:JSON.stringify({priceMinor:'969'})})).status,409);
assert.equal((await fetch(base+'/api/needs-funding')).status,401);
const after=await db.from('needs_funding').select('id,steps,status').eq('request_key',key).single();assert.equal(after.error,null);assert.deepEqual(after.data.steps,before.data.steps);
const balanceAfter=await noir.getEscrowBalance(before.data.device_hash);assert.equal(balanceAfter,balanceBefore);assert.equal(balanceAfter,10000000n);
const transaction=await noir.server.getTransaction(rows[0].transactionHash);assert.equal(transaction.status,'SUCCESS');
console.log(JSON.stringify({result:'pass',operationId:rows[0].id,status:rows[0].status,transactionHash:rows[0].transactionHash,ledgerStatus:transaction.status,backingStroops:balanceAfter.toString(),sameEnvelopesAfterConcurrentReplay:true,studentDenied:true,unauthenticatedDenied:true,changedAmountDenied:true}));
