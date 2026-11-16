import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { createHmac } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const appUrl = 'https://padalapocket.vercel.app';
export const taskTag = 'padalapocket-t04';
export const authConfigDirectory = fileURLToPath(new URL('../verification/identity/', import.meta.url));
const clientOptions = { auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: (url, options = {}) => fetch(url, { ...options, redirect: 'error', signal: AbortSignal.timeout(15000) }) } };

export async function accountDeliveryContext() {
  process.loadEnvFile(new URL('../../../.env.local', import.meta.url));
  const url = new URL(process.env.SUPABASE_URL);
  assert.match(url.hostname, /^[a-z]{20}\.supabase\.co$/);
  assert.equal(url.protocol, 'https:');
  assert.equal(url.pathname, '/');
  assert.ok(process.env.SUPABASE_PUBLISHABLE_KEY && process.env.SUPABASE_SECRET_KEY);
  const emails = [process.env.T04_PARENT_EMAIL, process.env.T04_STUDENT_EMAIL];
  for (const email of emails) assert.match(email ?? '', /^[^\s@]+@gmail\.com$/);
  assert.notEqual(emails[0], emails[1]);
  const admin = createClient(url.origin, process.env.SUPABASE_SECRET_KEY, clientOptions);
  const publicClient = () => createClient(url.origin, process.env.SUPABASE_PUBLISHABLE_KEY, clientOptions);
  // Reproducible credentials for approved test accounts only; no password file or rotation.
  const password = email => createHmac('sha256', process.env.SUPABASE_SECRET_KEY).update(`PadalaPocket:T04:v1:${email}`).digest('base64url') + 'Aa1!';
  const users = new Map();
  for (let page = 1; ; page++) {
    const result = await admin.auth.admin.listUsers({ page, perPage: 100 });
    assert.equal(result.error, null);
    for (const user of result.data.users) if (emails.includes(user.email)) {
      assert.equal(user.user_metadata?.verification_task, taskTag, 'EXISTING_NONTEST_ACCOUNT');
      users.set(user.email, user);
    }
    if (result.data.users.length < 100) break;
  }
  return { admin, publicClient, password, users, emails, projectRef: url.hostname.split('.')[0] };
}

export function validateIdentityConfiguration(result, expectedSender) {
  assert.equal(result.status, 0, 'AUTH_CONFIGURATION_READ_FAILED');
  const output = result.stdout;
  const data = JSON.parse(output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1));
  assert.ok(Array.isArray(data.changes));
  // Undeclared remote fields are informational, not drift to overwrite.
  assert.ok(data.changes.every(change => change.declared === false && change.class === 'remote_only'), 'CANONICAL_SITE_CONFIGURATION_REQUIRED');
  const redirects = data.changes.find(change => change.path.join('.') === 'auth.additional_redirect_urls')?.remote;
  assert.ok(Array.isArray(redirects) && redirects.some(url => [appUrl, appUrl + '/', appUrl + '/**'].includes(url)), 'PRODUCTION_REDIRECT_REQUIRED');
  assert.match(expectedSender ?? '', /^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'APPROVED_SMTP_SENDER_REQUIRED');
  const smtp = name => data.changes.find(change => change.path.join('.') === `auth.email.smtp.${name}`)?.remote;
  assert.equal(smtp('enabled'), true, 'APPROVED_SMTP_CONFIGURATION_REQUIRED');
  assert.equal(smtp('host'), 'smtp.gmail.com', 'APPROVED_SMTP_CONFIGURATION_REQUIRED');
  assert.equal(smtp('admin_email'), expectedSender, 'APPROVED_SMTP_CONFIGURATION_REQUIRED');
}

export function canonicalSiteConfiguration(projectRef, apply = false) {
  const result = spawnSync('supabase', ['config', apply ? 'push' : 'diff', '--workdir', authConfigDirectory, '--project-ref', projectRef, ...(apply ? ['--yes'] : ['--output-format', 'json'])], {
    encoding: 'utf8', timeout: 60000, stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (apply) assert.equal(result.status, 0, 'AUTH_CONFIGURATION_UPDATE_FAILED');
  else validateIdentityConfiguration(result, process.env.T04_SMTP_SENDER);
}

export async function assertFreshIdentityFixtures(admin, users) {
  assert.ok(users.length > 0, 'FRESH_UNENROLLED_FIXTURES_REQUIRED');
  for (const user of users) {
    const result = await admin.from('family_members').select('user_id').eq('user_id', user.id).maybeSingle();
    assert.equal(result.error ?? null, null);
    assert.equal(result.data, null, 'FRESH_UNENROLLED_FIXTURES_REQUIRED');
  }
}

export function validateCallbackEvidence(evidence, users, now = Date.now()) {
  assert.ok(evidence && typeof evidence === 'object');
  assert.equal(Object.keys(evidence).sort().join(','), 'parent,student', 'BOTH_CALLBACK_OBSERVATIONS_REQUIRED');
  for (const [index, role] of ['parent', 'student'].entries()) {
    const observation = evidence[role];
    assert.ok(observation && typeof observation === 'object');
    assert.equal(Object.keys(observation).sort().join(','), 'observedAt,origin,outcome,userId', 'TOKEN_FREE_CALLBACK_OBSERVATION_REQUIRED');
    assert.equal(observation.userId, users[index].id, 'CALLBACK_ACCOUNT_MISMATCH');
    assert.equal(observation.origin, appUrl, 'DEPLOYED_CALLBACK_REQUIRED');
    assert.equal(observation.outcome, 'setup', 'SUCCESSFUL_CALLBACK_REQUIRED');
    assert.equal(typeof observation.observedAt, 'string');
    const observedAt = Date.parse(observation.observedAt);
    const createdAt = Date.parse(users[index].created_at);
    assert.ok(Number.isFinite(observedAt) && Number.isFinite(createdAt) && observedAt >= createdAt && observedAt <= now + 30000, 'CURRENT_FIXTURE_OBSERVATION_REQUIRED');
  }
}

export async function readCallbackEvidence(input) {
  let raw = '';
  for await (const chunk of input) {
    raw += chunk;
    assert.ok(Buffer.byteLength(raw) <= 4096, 'CALLBACK_EVIDENCE_TOO_LARGE');
  }
  assert.ok(raw.trim(), 'CALLBACK_EVIDENCE_REQUIRED');
  return JSON.parse(raw);
}

export async function deployedRequest(path, token, method = 'GET', body) {
  assert.ok(path.startsWith('/api/'));
  const response = await fetch(appUrl + path, { method, redirect: 'error', signal: AbortSignal.timeout(15000), headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: response.status, body: await response.json() };
}
