import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { createHmac } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { localDockerEnvironment } from '../../../scripts/local-docker.mjs';

export const root = new URL('../../../', import.meta.url);
export const project = 'padalapocket-backend-verification';
export const options = { auth: { persistSession: false, autoRefreshToken: false } };
export const emails = ['parent-a', 'student-a', 'parent-b', 'student-b'].map(suffix => `verification-${suffix}@example.test`);
let commandEnvironment;
export function command(program, args, timeout = 60000) {
  commandEnvironment ??= localDockerEnvironment();
  return execFileSync(program, args, { cwd: root, env: commandEnvironment, encoding: 'utf8', timeout, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
}
export async function assertLocalProject() {
  const config = await readFile(new URL('supabase/config.toml', root), 'utf8');
  assert.match(config, /^project_id = "padalapocket-backend-verification"$/m);
  assert.match(config, /\[api\]\s+enabled = true\s+port = 54331\b/);
  assert.match(config, /\[db\]\s+port = 54332\b/);
}
export async function localConfiguration() {
  await assertLocalProject();
  const status = JSON.parse(command('supabase', ['status', '--output', 'json']));
  assert.equal(status.API_URL, 'http://127.0.0.1:54331');
  assert.ok(status.ANON_KEY && status.SERVICE_ROLE_KEY);
  // The local service role is the operator authority; never accept browser roles.
  const admin = createClient(status.API_URL, status.SERVICE_ROLE_KEY, options);
  const password = email => createHmac('sha256', status.SERVICE_ROLE_KEY).update(`padalapocket-verification:${email}`).digest('hex');
  return { status, admin, password };
}
export function assertLoopbackBindings() {
  const containers = command('docker', ['ps', '--filter', `label=com.supabase.cli.project=${project}`, '--format', '{{.Names}}']).trim().split('\n').filter(Boolean);
  assert.ok(containers.includes(`supabase_db_${project}`));
  for (const container of containers) {
    const bindings = JSON.parse(command('docker', ['inspect', '--format', '{{json .NetworkSettings.Ports}}', container]));
    for (const entries of Object.values(bindings ?? {})) {
      for (const binding of entries ?? []) assert.equal(binding.HostIp, '127.0.0.1');
    }
  }
}
