import { createClient } from '@supabase/supabase-js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const fail = (status, code, message) => Object.assign(new Error(message), { status, code });

export function createIdentityHandler({ env = process.env, clientFactory = createClient } = {}) {
  return async (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'no-store');
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
    try {
      const path = new URL(req.url, 'http://localhost').pathname;
      if (path !== '/api/me' && path !== '/api/identity-records' && !/^\/api\/identity-records\/[^/]+$/.test(path)) throw fail(404, 'NOT_FOUND', 'Route not found.');
      const recordId = path.startsWith('/api/identity-records/') ? path.split('/')[3] : null;
      const allowed = path === '/api/me' || recordId ? ['GET'] : ['POST'];
      if (!allowed.includes(req.method)) {
        res.setHeader('Allow', allowed.join(', '));
        throw fail(405, 'METHOD_NOT_ALLOWED', 'Method not allowed.');
      }
      const token = /^Bearer (\S+)$/.exec(req.headers.authorization ?? '')?.[1];
      if (!token) throw fail(401, 'UNAUTHENTICATED', 'Sign in required.');
      if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) throw fail(503, 'PROVIDER_UNAVAILABLE', 'Identity service unavailable.');
      const client = clientFactory(env.SUPABASE_URL, env.SUPABASE_PUBLISHABLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
        global: { headers: { Authorization: `Bearer ${token}` } },
      });
      const { data: auth, error: authError } = await client.auth.getUser(token);
      if (authError) {
        if (authError.status >= 500) throw fail(503, 'PROVIDER_UNAVAILABLE', 'Identity service unavailable.');
        throw fail(401, 'UNAUTHENTICATED', 'Sign in required.');
      }
      if (!auth?.user) throw fail(401, 'UNAUTHENTICATED', 'Sign in required.');
      const { data: member, error: memberError } = await client.from('family_members').select('user_id,family_id,role').eq('user_id', auth.user.id).maybeSingle();
      if (memberError) throw fail(503, 'PROVIDER_UNAVAILABLE', 'Identity service unavailable.');
      if (!member || !['parent', 'student'].includes(member.role)) throw fail(403, 'FORBIDDEN', 'Account is not provisioned.');
      if (path === '/api/me') return send(200, { userId: member.user_id, familyId: member.family_id, role: member.role });
      if (recordId) {
        if (!UUID.test(recordId) || path !== `/api/identity-records/${recordId}`) throw fail(400, 'INVALID_INPUT', 'Invalid record identifier.');
        const { data, error } = await client.from('identity_records').select('id,value,created_at').eq('id', recordId).eq('user_id', member.user_id).maybeSingle();
        if (error) throw fail(503, 'PROVIDER_UNAVAILABLE', 'Database unavailable.');
        if (!data) throw fail(404, 'NOT_FOUND', 'Record not found.');
        return send(200, data);
      }
      const key = req.headers['idempotency-key'];
      if (!UUID.test(key ?? '')) throw fail(400, 'INVALID_INPUT', 'A UUID Idempotency-Key is required.');
      let body = req.body;
      if (body === undefined) {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 1024) throw fail(413, 'INVALID_INPUT', 'Body too large.');
        }
        try { body = JSON.parse(raw); } catch { throw fail(400, 'INVALID_INPUT', 'Invalid JSON.'); }
      }
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw fail(400, 'INVALID_INPUT', 'Invalid JSON.'); } }
      if (!body || Object.keys(body).length !== 1 || typeof body.value !== 'string' || body.value.length < 1 || body.value.length > 120) throw fail(400, 'INVALID_INPUT', 'Provide only a value of 1–120 characters.');
      const { data, error } = await client.from('identity_records').insert({ user_id: member.user_id, request_key: key, value: body.value }).select('id,value,created_at').single();
      if (error?.code === '23505') {
        const prior = await client.from('identity_records').select('id,value,created_at').eq('user_id', member.user_id).eq('request_key', key).single();
        if (prior.error) throw fail(503, 'PROVIDER_UNAVAILABLE', 'Database unavailable.');
        if (prior.data.value !== body.value) throw fail(409, 'IDEMPOTENCY_CONFLICT', 'Request key already used for another value.');
        return send(200, prior.data);
      }
      if (error) throw fail(503, 'PROVIDER_UNAVAILABLE', 'Database unavailable.');
      return send(201, data);
    } catch (error) {
      send(error.status ?? 503, { error: { code: error.code ?? 'PROVIDER_UNAVAILABLE', message: error.status ? error.message : 'Service unavailable.', retryable: !error.status || error.status >= 500 } });
    }
  };
}
