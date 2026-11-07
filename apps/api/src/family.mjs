import { createClient } from '@supabase/supabase-js';
import { authenticateMember } from './identity.mjs';
import { phpToStroops, MONEY_MAPPING } from './money-mapping.mjs';

export const CATEGORY_CATALOG = Object.freeze([
  { id: 'meals', label: 'Meals' }, { id: 'snacks', label: 'Snacks and sweets' },
  { id: 'drinks', label: 'Drinks' }, { id: 'school_supplies', label: 'School supplies' },
  { id: 'books', label: 'Books and learning materials' }, { id: 'toys_collectibles', label: 'Toys and collectibles' },
]);
const categoryIds = CATEGORY_CATALOG.map(c => c.id);
export const DEFAULT_SETTINGS = Object.freeze({ weeklyAmountMinor: '968', needsPercent: 60, capMinor: '484', needsCategories: ['meals', 'school_supplies', 'books'], wantsCategories: [] });
const fail = (status, code) => Object.assign(Error(code), { status, code });
const positiveMinor = value => typeof value === 'string' && /^[1-9][0-9]{0,8}$/.test(value);
export function validSettings(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join(',') !== 'capMinor,needsCategories,needsPercent,wantsCategories,weeklyAmountMinor') return false;
  return positiveMinor(value.capMinor) && positiveMinor(value.weeklyAmountMinor) && Number.isInteger(value.needsPercent) && value.needsPercent >= 0 && value.needsPercent <= 100 && ['needsCategories','wantsCategories'].every(key => Array.isArray(value[key]) && value[key].length <= categoryIds.length && new Set(value[key]).size === value[key].length && value[key].every(id => categoryIds.includes(id)));
}
export async function readFamilyRules(db, familyId) {
  const result = await db.from('family_rules').select('revision,settings,updated_at').eq('family_id', familyId).maybeSingle();
  if (result.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
  if (!result.data) return { revision: 0, settings: structuredClone(DEFAULT_SETTINGS), updatedAt: null };
  if (!validSettings(result.data.settings)) throw fail(503, 'INVALID_STORED_RULES');
  return { revision: Number(result.data.revision), settings: result.data.settings, updatedAt: result.data.updated_at };
}
export function purchaseRulesFromSettings({ revision, settings }) {
  return { version: revision ? `family-v1-${revision}` : 'needs-demo-v1', capMinor: settings.capMinor, capStroops: phpToStroops(settings.capMinor), allowedCategories: settings.needsCategories, sellerId: 'demo-seller', mappingVersion: MONEY_MAPPING.version };
}
const activityColumns = 'id,student_id,status,reason,seller_id,price_minor,amount_stroops,ai,created_at,reserved';
export async function family(req, res, { authenticate = authenticateMember, database = createClient } = {}) {
  res.setHeader('Content-Type', 'application/json'); res.setHeader('Cache-Control', 'no-store');
  const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)); };
  try {
    const path = new URL(req.url, 'http://localhost').pathname;
    if (!['/api/family/rules','/api/family/activity'].includes(path)) throw fail(404, 'NOT_FOUND');
    if (!(path.endsWith('rules') ? ['GET','PUT'] : ['GET']).includes(req.method)) throw fail(405, 'METHOD_NOT_ALLOWED');
    const { member } = await authenticate(req);
    if (!['parent','student'].includes(member.role) || !member.family_id) throw fail(403, 'FORBIDDEN');
    if (req.method === 'PUT' && member.role !== 'parent') throw fail(403, 'FORBIDDEN');
    const db = database(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
    if (path.endsWith('rules')) {
      if (req.method === 'GET') return send(200, { ...await readFamilyRules(db, member.family_id), categories: CATEGORY_CATALOG, activePurchaseBucket: 'needs', schedulingEnabled: false });
      let body = req.body;
      if (body === undefined) { let raw = ''; for await (const chunk of req) { raw += chunk; if (Buffer.byteLength(raw) > 4096) throw fail(413, 'INVALID_INPUT'); } try { body = JSON.parse(raw); } catch { throw fail(400, 'INVALID_INPUT'); } }
      if (typeof body === 'string') { try { body = JSON.parse(body); } catch { throw fail(400, 'INVALID_INPUT'); } }
      if (!body || Object.keys(body).sort().join(',') !== 'expectedRevision,settings' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 0 || body.expectedRevision > 1000000000 || !validSettings(body.settings)) throw fail(400, 'INVALID_INPUT');
      const saved = await db.rpc('save_family_rules', { p_family: member.family_id, p_parent: member.user_id, p_expected: body.expectedRevision, p_settings: body.settings });
      if (saved.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
      if (!saved.data) throw fail(409, 'RULES_CHANGED');
      return send(200, { revision: Number(saved.data.revision), settings: saved.data.settings, updatedAt: saved.data.updated_at });
    }
    let query = db.from('needs_purchases').select(activityColumns).eq('family_id', member.family_id);
    if (member.role === 'student') query = query.eq('student_id', member.user_id);
    const result = await query.order('created_at', { ascending: false }).limit(100);
    if (result.error) throw fail(503, 'PROVIDER_UNAVAILABLE');
    const items = result.data.map(row => ({ id: row.id, status: row.status, reason: row.reason, sellerId: row.seller_id, priceMinor: row.price_minor, amountStroops: String(row.amount_stroops), bucket: 'needs', productName: row.ai?.productName ?? null, category: row.ai?.category ?? null, createdAt: row.created_at, photoPath: `/api/purchases/${row.id}/photo` }));
    return send(200, { items, limit: 100 });
  } catch (error) { send(error.status ?? 503, { error: { code: error.code ?? 'PROVIDER_UNAVAILABLE', message: error.code ?? 'Family service unavailable.', retryable: false } }); }
}
