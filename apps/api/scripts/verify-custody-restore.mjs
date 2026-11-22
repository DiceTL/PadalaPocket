import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { randomBytes, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Keypair } from '@stellar/stellar-sdk';
import { assertLocalProject, assertLoopbackBindings, command, project } from './local-verification.mjs';
import { localDockerEnvironment } from '../../../scripts/local-docker.mjs';

let stage = 'isolated-container';
let container, env;
const docker = (args, input) => execFileSync('docker', args, {
  env, input, encoding: 'utf8', timeout: 30000, stdio: ['pipe', 'pipe', 'pipe'],
}).trim();
const inside = (args, input) => docker(['exec', '-i', container, ...args], input);
const shell = script => inside(['sh', '-se'], script);
const sql = (cluster, script) => inside(['psql', '-XqAt', '-h', `/tmp/${cluster}`, '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], script);
const worker = fileURLToPath(new URL('./restore-verification-worker.mjs', import.meta.url));
const start = (cluster, key) => shell(`
  pg_ctl -D /tmp/${cluster} -l /tmp/${cluster}/server.log -w start \\
    -o "-c listen_addresses= -c unix_socket_directories=/tmp/${cluster} -c shared_preload_libraries=supabase_vault -c vault.getkey_script=/tmp/operator/${key}" >/dev/null
`);

try {
  env = localDockerEnvironment();
  await assertLocalProject();
  assertLoopbackBindings();
  const image = command('docker', ['inspect', `supabase_db_${project}`, '--format', '{{.Image}}']).trim();
  assert.match(image, /^sha256:[0-9a-f]{64}$/);
  // Trust authentication is limited to Unix sockets in this disposable, networkless container.
  container = docker(['run', '--detach', '--rm', '--pull=never', '--network', 'none', '--user', 'postgres',
    '--tmpfs', '/tmp:exec,size=256m,mode=1777', '--entrypoint', 'sleep', image, 'infinity']);
  assert.match(container, /^[0-9a-f]{64}$/);
  stage = 'source-vault';
  shell(`
    umask 077
    mkdir /tmp/operator
    for key in retained wrong; do
      head -c 32 /dev/urandom | od -An -tx1 | tr -d ' \\n' > "/tmp/operator/$key.hex"
      printf '#!/bin/sh\\nexec cat /tmp/operator/%s.hex\\n' "$key" > "/tmp/operator/$key"
      chmod 700 "/tmp/operator/$key"
    done
    initdb -A trust --no-locale -D /tmp/source >/dev/null
    initdb -A trust --no-locale -D /tmp/target >/dev/null
  `);
  start('source', 'retained');
  const roles = 'create role anon; create role authenticated; create role service_role; create role money_coordinator;';
  const migration = readFileSync(new URL('../../../supabase/migrations/20261122090000_t09_vault_access.sql', import.meta.url), 'utf8');
  const actor = randomUUID(), family = randomUUID(), other = randomUUID(), otherFamily = randomUUID();
  function seedFixture() {
    const pair = Keypair.random(); // Disposable, unfunded and never sent to a network.
    const address = pair.publicKey();
    sql('source', `${roles}
      create schema vault;
      create table public.family_members (user_id uuid primary key, family_id uuid not null);
      ${migration}
      insert into public.family_members values ('${actor}','${family}'), ('${other}','${otherFamily}');
      insert into wallet_custody.family_signing_keys values
        ('${family}','parent','testnet','${address}',1,vault.create_secret('${pair.secret()}'));`);
    return address;
  }
  const address = seedFixture();
  const message = randomBytes(32).toString('hex');
  const probe = (cluster, mode) => {
    const result = execFileSync(process.execPath, [worker], { env, encoding: 'utf8', timeout: 15000,
      input: JSON.stringify({ container, cluster, mode, actor, family, other, address, message }), stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    if (mode === 'wrong-root') return assert.equal(result, 'decrypt-denied');
    assert.match(result, /^[0-9a-f]{128}$/);
    assert.equal(Keypair.fromPublicKey(address).verify(Buffer.from(message, 'hex'), Buffer.from(result, 'hex')), true);
  };
  stage = 'fresh-source-process';
  probe('source', 'sign');

  stage = 'encrypted-backup-and-restore';
  shell(`
    umask 077
    pg_dump -h /tmp/source -U postgres -Fc -f /tmp/vault.backup postgres
    pg_ctl -D /tmp/source -w -m fast stop >/dev/null
  `);
  start('target', 'wrong');
  sql('target', `${roles} create role family_custody_worker nologin noinherit;`);
  inside(['pg_restore', '--exit-on-error', '--single-transaction', '-h', '/tmp/target', '-U', 'postgres', '-d', 'postgres', '/tmp/vault.backup']);
  stage = 'restored-fixture-present';
  assert.equal(sql('target', 'select count(*) from vault.secrets; select count(*) from wallet_custody.family_signing_keys;'), '1\n1');
  stage = 'wrong-root-denial';
  probe('target', 'wrong-root');
  shell('pg_ctl -D /tmp/target -w -m fast stop >/dev/null');
  start('target', 'retained');
  stage = 'fresh-restored-process';
  probe('target', 'sign');
} catch {
  console.error(`FAIL: custody-restore (${stage})`);
  process.exitCode = 1;
} finally {
  if (/^[0-9a-f]{64}$/.test(container ?? '')) {
    try { docker(['rm', '-f', container]); }
    catch { console.error('FAIL: custody-restore (disposable container cleanup)'); process.exitCode = 1; }
  }
}
if (!process.exitCode) console.log('PASS: custody-restore');
