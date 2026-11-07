import {createClient} from '@supabase/supabase-js';
import {createHash,randomBytes} from 'node:crypto';
const fail=(status,code)=>Object.assign(Error(code),{status,code});
export async function accounts(req,res,{database=createClient}={}){
 res.setHeader('Content-Type','application/json');res.setHeader('Cache-Control','no-store');
 const send=(status,body)=>{res.statusCode=status;res.end(JSON.stringify(body));};
 try{
  if(!['GET','POST'].includes(req.method))throw fail(405,'METHOD_NOT_ALLOWED');
  const token=/^Bearer (\S+)$/.exec(req.headers.authorization??'')?.[1];if(!token)throw fail(401,'UNAUTHENTICATED');
  const auth=database(process.env.SUPABASE_URL,process.env.SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false}});
  const user=await auth.auth.getUser(token);if(user.error||!user.data?.user)throw fail(401,'UNAUTHENTICATED');
  const u=user.data.user;if(!u.email_confirmed_at)throw fail(403,'EMAIL_VERIFICATION_REQUIRED');
  const path=new URL(req.url,'http://localhost').pathname;
  if(req.method==='GET'){
   if(path!=='/api/accounts/status')throw fail(404,'NOT_FOUND');
   const db=database(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}});
   const member=await db.from('family_members').select('family_id,role').eq('user_id',u.id).maybeSingle();if(member.error)throw fail(503,'ACCOUNT_SERVICE_UNAVAILABLE');
   if(!member.data)throw fail(403,'ACCOUNT_SETUP_REQUIRED');
   const student=await db.from('family_members').select('user_id').eq('family_id',member.data.family_id).eq('role','student').maybeSingle();if(student.error)throw fail(503,'ACCOUNT_SERVICE_UNAVAILABLE');
   return send(200,{studentLinked:Boolean(student.data)});
  }
  let body=req.body;if(body===undefined){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>1024)throw fail(400,'INVALID_INPUT');}try{body=JSON.parse(raw);}catch{throw fail(400,'INVALID_INPUT');}}
  if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw fail(400,'INVALID_INPUT');}}
  const db=database(process.env.SUPABASE_URL,process.env.SUPABASE_SECRET_KEY,{auth:{persistSession:false}}),hash=s=>createHash('sha256').update(s).digest('hex');
  if(path==='/api/accounts/student-code'){
   if(!body || Object.keys(body).join(',')!=='email' || typeof body.email!=='string' || body.email.length>254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) || body.email.trim().toLowerCase()===u.email.toLowerCase())throw fail(400,'INVALID_STUDENT_EMAIL');
   const code=randomBytes(24).toString('hex');const result=await db.rpc('create_student_setup_code',{p_parent:u.id,p_email:body.email.trim().toLowerCase(),p_hash:hash(code)});
   if(result.error)throw fail(409,result.error.message.includes('STUDENT_ALREADY_LINKED')?'STUDENT_ALREADY_LINKED':'SETUP_CODE_UNAVAILABLE');
   return send(201,{code,expiresInHours:24});
  }
  if(path!=='/api/accounts/enroll' || !body || !['role','code,role'].includes(Object.keys(body).sort().join(',')) || !['parent','student'].includes(body.role) || body.role==='student' && !/^[a-f0-9]{48}$/.test(body.code??'') || body.role==='parent' && body.code!==undefined)throw fail(400,'INVALID_INPUT');
  const result=await db.rpc('enroll_account',{p_user:u.id,p_code_hash:body.role==='student'?hash(body.code):null});
  if(result.error)throw fail(409,result.error.message.includes('INVALID_OR_EXPIRED_CODE')?'INVALID_OR_EXPIRED_CODE':'ACCOUNT_SETUP_FAILED');
  return send(200,{enrolled:true});
 }catch(e){send(e.status??503,{error:{code:e.code??'ACCOUNT_SERVICE_UNAVAILABLE',message:e.code??'Account service unavailable.',retryable:false}});}
}
