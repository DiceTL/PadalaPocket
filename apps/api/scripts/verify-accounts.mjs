// Explicit synthetic Auth/API verification. Generates links without sending email; no payments.
import {createClient} from '@supabase/supabase-js';import {randomUUID} from 'node:crypto';import assert from 'node:assert/strict';import {accounts} from '../src/accounts.mjs';import {purchases} from '../src/purchases.mjs';import {createIdentityHandler} from '../src/identity.mjs';
if(process.argv[2]!=='--run')throw Error('Explicit --run required');
const admin=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}),created=[];let family;
const invoke=async(handler,token,url,method,body)=>{const res={setHeader(){},end(v){this.body=JSON.parse(v);}};await handler({headers:{authorization:'Bearer '+token},url,method,body},res);return res;};
try{
 const sessions=[];
 for(const role of ['parent','student']){const email=`l008-${role}-${randomUUID()}@example.invalid`,password=randomUUID()+'Aa1!';const link=await admin.auth.admin.generateLink({type:'signup',email,password});if(link.error)throw Error('GENERATE_LINK_FAILED');created.push(link.data.user.id);const client=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});const verified=await client.auth.verifyOtp({token_hash:link.data.properties.hashed_token,type:'signup'});if(verified.error)throw Error('CONFIRMATION_FAILED');sessions.push({email,token:verified.data.session.access_token});}
 const [parent,child]=sessions,identity=createIdentityHandler();
 assert.equal((await invoke(identity,parent.token,'/api/me','GET')).body.error.code,'ACCOUNT_SETUP_REQUIRED');
 assert.equal((await invoke(accounts,parent.token,'/api/accounts/enroll','POST',{role:'parent'})).statusCode,200);
 const me=(await invoke(identity,parent.token,'/api/me','GET')).body;family=me.familyId;assert.equal(me.walletReady,false);
 const invitation=await invoke(accounts,parent.token,'/api/accounts/student-code','POST',{email:child.email});assert.equal(invitation.statusCode,201);
 assert.equal((await invoke(accounts,child.token,'/api/accounts/enroll','POST',{role:'student',code:invitation.body.code})).statusCode,200);
 const student=(await invoke(identity,child.token,'/api/me','GET')).body;assert.equal(student.familyId,family);assert.equal(student.role,'student');assert.equal(student.walletReady,false);
 assert.equal((await invoke(purchases,child.token,'/api/purchases','GET')).body.error.code,'WALLET_SETUP_REQUIRED');
 assert.equal((await invoke(accounts,parent.token,'/api/accounts/status','GET')).body.studentLinked,true);
 console.log('PASS: actual signup-link confirmation, parent/student enrollment, linking, identity and demo-wallet exclusion. No email delivery or wallet provisioning claimed.');
}finally{
 if(family){const c=await admin.from('student_setup_codes').delete().eq('family_id',family);if(c.error)throw Error('CODE_CLEANUP_FAILED');}
 for(const id of created){const m=await admin.from('family_members').delete().eq('user_id',id);if(m.error)throw Error('MEMBERSHIP_CLEANUP_FAILED');const u=await admin.auth.admin.deleteUser(id);if(u.error)throw Error('AUTH_CLEANUP_FAILED');}
 console.log('Synthetic verification accounts removed.');
}
