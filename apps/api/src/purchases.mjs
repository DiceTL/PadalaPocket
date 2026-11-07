import { approvalBinding, REVIEW_REASONS, EXCEPTION_STAGES } from './purchase-approval.mjs';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { authenticateMember } from './identity.mjs';
import { phpToStroops } from './money-mapping.mjs';
import { decidePurchase } from './purchase-rules.mjs';
import { validatePhoto, identifyPhoto, purchaseLedger } from './purchase-providers.mjs';
import { readFamilyRules, purchaseRulesFromSettings } from './family.mjs';
const fail = (status, code) => Object.assign(Error(code), { status, code });
const uuid = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export const purchaseProjection = row => ({ id: row.id, bucket: row.bucket ?? 'needs', requestKey: row.request_key, status: row.status, reason: row.reason, sellerId: row.seller_id, priceMinor: row.price_minor, amountStroops: String(row.amount_stroops), rules: row.rules, ai: row.ai, createdAt: row.created_at, approvalBinding: row.approval_binding ?? null, approvalDeadline: row.approval_deadline ?? null, parentDecision: row.parent_decision ?? null, executionStarted: Boolean(row.exception_started), completedStages: row.exception_stage ?? 0, transactions: Object.fromEntries(Object.entries(row.steps).map(([name, step]) => [name, { hash: step.hash }])), evidence: row.evidence });
export async function purchases(req, res, { authenticate = authenticateMember, database = createClient, validate = validatePhoto, identify = identifyPhoto, ledger = purchaseLedger, loadRules = readFamilyRules } = {}) {
  res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json');
  const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    const match = /^\/api\/purchases(?:\/([0-9a-f-]+)\/(photo|claim|decision|execute))?$/.exec(path);
    if (!match || match[1] && !uuid.test(match[1])) throw fail(404, 'NOT_FOUND');
    if (!['GET','POST'].includes(req.method) || match[2] === 'photo' && req.method !== 'GET' || ['claim','decision','execute'].includes(match[2]) && req.method !== 'POST') throw fail(405, 'METHOD_NOT_ALLOWED');
    const { member } = await authenticate(req);
    if (!['student','parent'].includes(member.role) || ['decision','execute'].includes(match[2]) && member.role !== 'parent' || member.role === 'parent' && !['photo','decision','execute'].includes(match[2]) && req.method !== 'GET') throw fail(403, 'FORBIDDEN');
    const db = database(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    const table = () => db.from('needs_purchases');
    const expired = await db.rpc('expire_purchase_reviews');
    if (expired.error) throw fail(503,'PROVIDER_UNAVAILABLE');
    const save = async (row, patch, { beforeClaim = false } = {}) => {
      let update = table().update(patch).eq('id', row.id).eq('status', row.status);
      // Admission is a durable boundary, including for reads started before it.
      if (beforeClaim) update = update.eq('claim_started', false);
      const result = await update.select('*').maybeSingle();
      if (result.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
      if (!result.data) {
        const latest = await table().select('*').eq('id', row.id).maybeSingle();
        if (latest.error || !latest.data) throw fail(503, 'PROVIDER_UNAVAILABLE');
        Object.assign(row, latest.data);
        return false;
      }
      Object.assign(row, result.data);
      return true;
    };
    let chain;
    const network = () => chain ??= ledger();
    const device = row => hash('PadalaPocket ' + (row.bucket === 'wants' ? 'Wants ' : 'Needs ') + member.family_id);
    async function reconcile(row) {
      if (row.status === 'unknown' && row.reason === 'AI_UNAVAILABLE' && !row.reserved && !row.ai && Object.keys(row.steps).length === 0) { await save(row, { status: 'blocked' }); return; }
      if (['blocked','claimed','failed','awaiting_parent','approved','rejected','expired'].includes(row.status)) return;
      if (row.parent_decision?.decision === 'approve') {
        // Reads may only close a fully dispatched, confirmed exception; never start missing stages.
        if (!EXCEPTION_STAGES.every(stage=>row.steps[stage])) return;
        for(const stage of EXCEPTION_STAGES) if((await network().status(row.steps[stage].hash)).status!=='SUCCESS') return;
        if(await network().pending()!==0n || !await network().exceptionComplete(row)) return;
        await save(row,{status:'claimed',reason:null,evidence:{...row.evidence,claimLedgerStatus:'SUCCESS',merchantPendingStroops:'0',exceptionRevoked:true}});
        return;
      }
      // Preparation may still be running in the admitted writer. A GET must not
      // downgrade that phase, clear the lock, or create a replacement claim.
      if (row.claim_started && !row.steps.claim) return;
      for (const stage of ['claim','authorize','policy']) {
        if (!row.steps[stage]) continue;
        const result = await network().status(row.steps[stage].hash);
        if (result.status === 'FAILED') { await save(row, { status: 'failed', reason: `${stage.toUpperCase()}_FAILED` }, { beforeClaim: stage !== 'claim' }); return; }
        if (result.status !== 'SUCCESS') return;
        if (stage === 'claim') {
          const pending = await network().pending();
          if (pending !== 0n) return;
          if (!await save(row, { status: 'claimed', reason: null, evidence: { ...row.evidence, claimLedgerStatus: 'SUCCESS', merchantPendingStroops: '0' } })) return;
        } else if (stage === 'authorize') { if (!await save(row, { status: 'merchant_pending', reason: null, evidence: { ...row.evidence, authorizationLedgerStatus: 'SUCCESS' } }, { beforeClaim: true })) return; }
        return;
      }
    }
    async function dispatch(row, stage, pendingStatus) {
      if (row.steps[stage]) throw Error('STEP_ALREADY_EXISTS');
      const step = await network().prepare(stage, row, device(row));
      if (!await save(row, { steps: { ...row.steps, [stage]: step }, status: pendingStatus })) throw Error('STALE_OPERATION');
      await network().submit(step.signed);
      const result = await network().status(step.hash);
      if (result.status !== 'SUCCESS') throw Error('TRANSACTION_UNKNOWN');
    }
    async function claim(row) {
      if(row.parent_decision) return;
      const admission = await table().update({ claim_started: true, status: 'claim_pending' }).eq('id', row.id).eq('status', 'merchant_pending').eq('claim_started', false).select('id').maybeSingle();
      if (admission.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
      if (!admission.data) return;
      row.status = 'claim_pending'; row.claim_started = true;
      try { if (await network().pending() !== BigInt(row.amount_stroops)) throw Error('MERCHANT_PENDING_MISMATCH'); await dispatch(row, 'claim', 'claim_pending'); await reconcile(row); }
      catch { await save(row, { status: 'unknown' }); }
    }
    async function executeException(row) {
      const admission=await db.rpc('admit_purchase_exception',{p_id:row.id,p_parent:member.user_id,p_family:member.family_id});
      if(admission.error)throw fail(503,'PROVIDER_UNAVAILABLE');
      if(admission.data?.error)throw fail(404,admission.data.error);
      if(!admission.data?.row)throw fail(503,'PROVIDER_UNAVAILABLE');
      Object.assign(row,admission.data.row);
      if(!admission.data.admitted){await reconcile(row);return;}
      try {
        const index=row.exception_stage,stage=EXCEPTION_STAGES[index];
        if(index===0){
          if(!await save(row,{status:'exception_pending',exception_consent:network().consent(row),evidence:{merchant:network().merchantPublicKey}}))return;
          if(!await network().exceptionReady(row) || await network().escrow(device(row))<BigInt(row.amount_stroops) || await network().pending()!==0n)throw Error('BACKING_UNAVAILABLE');
        }
        await dispatch(row,stage,'exception_pending');
        if(stage==='exception_authorize' && await network().pending()!==BigInt(row.amount_stroops))throw Error('MERCHANT_PENDING_MISMATCH');
        await save(row,{exception_stage:index+1,exception_started:false});
        if(index===EXCEPTION_STAGES.length-1)await reconcile(row);
      } catch { await save(row,{status:'unknown',reason:'EXCEPTION_RECONCILIATION_REQUIRED'}); }
    }
    if (match[1]) {
      const found = await table().select('*').eq('id', match[1]).eq('family_id', member.family_id).maybeSingle();
      if (found.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
      if (!found.data || member.role === 'student' && found.data.student_id !== member.user_id) throw fail(404, 'NOT_FOUND');
      const row = found.data;
      if (match[2] === 'photo') { res.setHeader('Content-Type', row.photo_mime); res.setHeader('X-Content-Type-Options', 'nosniff'); res.statusCode = 200; return res.end(Buffer.from(row.photo_base64, 'base64')); }
      if(match[2]==='execute'){await executeException(row);return send(row.status==='claimed'?200:202,purchaseProjection(row));}
      if(match[2]==='decision') {
        let body=req.body;
        if(body===undefined){let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>1024)throw fail(400,'INVALID_INPUT');}try{body=JSON.parse(raw);}catch{throw fail(400,'INVALID_INPUT');}}
        if(typeof body==='string'){try{body=JSON.parse(body);}catch{throw fail(400,'INVALID_INPUT');}}
        if(!body || Object.keys(body).sort().join(',')!=='binding,decision' || !['approve','reject'].includes(body.decision) || !/^[a-f0-9]{64}$/.test(body.binding??''))throw fail(400,'INVALID_INPUT');
        if(row.approval_binding!==body.binding || approvalBinding(row)!==body.binding)throw fail(409,'PURCHASE_CHANGED');
        const result=await db.rpc('decide_purchase_review',{p_id:row.id,p_parent:member.user_id,p_family:member.family_id,p_decision:body.decision,p_binding:body.binding});
        if(result.error)throw fail(503,'PROVIDER_UNAVAILABLE');
        if(result.data?.error)throw fail(result.data.error==='NOT_FOUND'?404:409,result.data.error);
        if(!result.data?.row)throw fail(503,'PROVIDER_UNAVAILABLE');
        Object.assign(row,result.data.row);
        if(result.data.admitted)await executeException(row);
        else await reconcile(row);
        return send(row.status==='claimed'||row.status==='rejected'?200:202,purchaseProjection(row));
      }
      await reconcile(row); await claim(row); return send(200, purchaseProjection(row));
    }
    if (req.method === 'GET') {
      let list=table().select('*').eq('family_id',member.family_id);
      if(member.role==='student')list=list.eq('student_id',member.user_id);
      const result=await list.order('created_at',{ascending:false});
      if (result.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
      for (const row of result.data) await reconcile(row);
      if(member.role==='parent')return send(200,{purchases:result.data.map(purchaseProjection)});
      const funding = await db.from('needs_funding').select('amount_stroops,wants_stroops').eq('family_id', member.family_id).eq('status', 'confirmed');
      if (funding.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
      const credits = funding.data.reduce((sum, row) => sum + BigInt(row.amount_stroops), 0n);
      const held = result.data.filter(row => row.reserved && row.bucket !== 'wants').reduce((sum, row) => sum + BigInt(row.amount_stroops), 0n);
      const familyRules = await loadRules(db, member.family_id);
      return send(200, { purchases: result.data.map(purchaseProjection), rules: purchaseRulesFromSettings(familyRules), availableNeedsStroops: (credits - held).toString(), wantsRules: purchaseRulesFromSettings(familyRules, 'wants'), availableWantsStroops: (funding.data.reduce((sum,r)=>sum+BigInt(r.wants_stroops??'0'),0n) - result.data.filter(row=>row.reserved && row.bucket==='wants').reduce((sum,row)=>sum+BigInt(row.amount_stroops),0n)).toString() });
    }
    const key = req.headers['idempotency-key']; if (!uuid.test(key ?? '')) throw fail(400, 'INVALID_INPUT');
    let body = req.body;
    if (body === undefined) { let raw = ''; for await (const part of req) { raw += part; if (Buffer.byteLength(raw) > 3000000) throw fail(400, 'INVALID_INPUT'); } try { body = JSON.parse(raw); } catch { throw fail(400, 'INVALID_INPUT'); } }
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw fail(400, 'INVALID_INPUT'); } }
    if (!body || !['mime,photoBase64,priceMinor,sellerId','bucket,mime,photoBase64,priceMinor,sellerId'].includes(Object.keys(body).sort().join(',')) || body.bucket !== undefined && !['needs','wants'].includes(body.bucket) || body.sellerId !== 'demo-seller' || typeof body.priceMinor !== 'string' || !/^[1-9][0-9]{0,8}$/.test(body.priceMinor) || !['image/png','image/jpeg'].includes(body.mime) || typeof body.photoBase64 !== 'string' || body.photoBase64.length > 2796204) throw fail(400, 'INVALID_INPUT');
    const bytes = Buffer.from(body.photoBase64, 'base64');
    if (!bytes.length || bytes.length > 2097152 || bytes.toString('base64') !== body.photoBase64) throw fail(400, 'INVALID_PHOTO');
    const bucket = body.bucket ?? 'needs';
    const fingerprint = hash(JSON.stringify([body.sellerId, body.priceMinor, body.mime, hash(bytes), ...(bucket === 'wants' ? [bucket] : [])]));
    const existing = await table().select('*').eq('student_id', member.user_id).eq('request_key', key).maybeSingle();
    if (existing.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
    if (existing.data) { if (existing.data.fingerprint !== fingerprint) throw fail(409, 'IDEMPOTENCY_CONFLICT'); await reconcile(existing.data); return send(200, purchaseProjection(existing.data)); }
    try { await validate(bytes, body.mime); } catch { throw fail(400, 'INVALID_PHOTO'); }
    const savedRules = purchaseRulesFromSettings(await loadRules(db, member.family_id), bucket);
    const inserted = await table().insert({ family_id: member.family_id, bucket, student_id: member.user_id, request_key: key, fingerprint, seller_id: body.sellerId, price_minor: body.priceMinor, amount_stroops: phpToStroops(body.priceMinor), photo_base64: body.photoBase64, photo_mime: body.mime, photo_hash: hash(bytes), rules: savedRules }).select('*').single();
    if (inserted.error) {
      if (inserted.error.code !== '23505') throw fail(503, 'PROVIDER_UNAVAILABLE');
      const replay = await table().select('*').eq('student_id', member.user_id).eq('request_key', key).maybeSingle();
      if (!replay.data) throw fail(409, 'PURCHASE_PENDING');
      if (replay.data.fingerprint !== fingerprint) throw fail(409, 'IDEMPOTENCY_CONFLICT');
      return send(200, purchaseProjection(replay.data));
    }
    let row = inserted.data;
    try {
      const assessment = await identify(bytes, body.mime);
      await save(row, { ai: assessment.ai, ai_usage: { usage: assessment.usage, model: assessment.model } });
      const reason = decidePurchase(row.ai, row.price_minor, '999999999999999999', row.rules);
      if (reason && !REVIEW_REASONS.has(reason)) { await save(row, { status: 'blocked', reason }); return send(201, purchaseProjection(row)); }
      const reservation = await db.rpc('reserve_needs_purchase', { p_id: row.id });
      if (reservation.error) throw Error('RESERVATION_UNAVAILABLE');
      if (!reservation.data) { const read = await table().select('*').eq('id', row.id).single(); if (read.error) throw Error('READ_UNAVAILABLE'); return send(201, purchaseProjection(read.data)); }
      const reserved = await table().select('*').eq('id', row.id).single();
      if (reserved.error || !reserved.data || reserved.data.status !== 'reserved' || !reserved.data.reserved) throw Error('RESERVATION_STATE_UNAVAILABLE');
      row = reserved.data;
      if(REVIEW_REASONS.has(reason)){
        const review=await db.rpc('begin_purchase_review',{p_id:row.id,p_binding:approvalBinding(row),p_reason:reason});
        if(review.error||!review.data)throw Error('REVIEW_UNAVAILABLE');
        row=review.data;
        return send(201,purchaseProjection(row));
      }
      await save(row, { status: 'reserved', reserved: true, evidence: { merchant: network().merchantPublicKey } });
      if (await network().escrow(device(row)) < BigInt(row.amount_stroops)) throw Error('BACKING_UNAVAILABLE');
      if (await network().pending() !== 0n) throw Error('MERCHANT_PENDING_CONFLICT');
      await dispatch(row, 'policy', 'policy_pending');
      const check = await network().check(device(row), row.amount_stroops);
      if (!check.ok) throw Error('POLICY_BLOCKED');
      await dispatch(row, 'authorize', 'authorization_pending');
      await reconcile(row); await claim(row);
    } catch (error) { await save(row, { status: row.ai ? 'unknown' : 'blocked', reason: row.ai ? 'OPERATION_PENDING' : 'AI_UNAVAILABLE', ...(!row.ai ? { ai_usage: error.aiDiagnostic ?? { errorType: error.name === 'TimeoutError' ? 'TIMEOUT' : 'PROVIDER_OR_INVALID_RESPONSE' } } : {}) }); }
    return send(row.status === 'claimed' || row.status === 'blocked' ? 201 : 202, purchaseProjection(row));
  } catch (error) { send(error.status ?? 503, { error: { code: error.code ?? 'PROVIDER_UNAVAILABLE', message: error.code ?? 'Purchase service unavailable.', retryable: false } }); }
}
