import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const original = { ...process.env };
afterEach(() => {
  process.env = { ...original };
});

// Each import gets a fresh command cache; no real Docker commands are run here.
let revision = 0;
const commands = () => import(`../scripts/local-verification.mjs?boundary=${++revision}`);
function dockerEnvironment(overrides = {}) {
  process.env = { PATH: original.PATH, HOME: '/synthetic/home', DOCKER_CONFIG: '/synthetic/docker', XDG_RUNTIME_DIR: '/synthetic/run', ...overrides };
}
async function stubCommands(t, host) {
  const calls = [];
  t.mock.method(childProcess, 'execFileSync', (program, args, options) => {
    calls.push({ program, args, options });
    return args[0] === 'context' ? JSON.stringify(host) : '';
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  return calls;
}

test('direct remote Docker targets are rejected before any setup command', async t => {
  for (const host of ['ssh://remote.example', 'tcp://remote.example:2376', 'tcp://127.0.0.1:2375']) {
    dockerEnvironment({ DOCKER_HOST: host });
    const calls = await stubCommands(t, host);
    const { command } = await commands();
    assert.throws(() => command('docker', ['network', 'create', 'verification']), /LOCAL_DOCKER_REQUIRED/);
    assert.equal(calls.length, 0);
    t.mock.restoreAll(); syncBuiltinESMExports();
  }
});

for (const selected of [false, true]) test(`${selected ? 'selected' : 'active'} remote Docker context is rejected before side effects`, async t => {
  dockerEnvironment(selected ? { DOCKER_CONTEXT: 'remote', DOCKER_HOST: 'unix:///var/run/docker.sock' } : {});
  const calls = await stubCommands(t, 'ssh://remote.example');
  const { command } = await commands();
  assert.throws(() => command('docker', ['network', 'create', 'verification']), /LOCAL_DOCKER_REQUIRED/);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].program, 'docker');
  assert.deepEqual(calls[0].args.slice(0, 2), ['context', 'inspect']);
  if (selected) assert.ok(calls[0].args.includes('remote'));
});

test('local rootless context is pinned for Docker and Supabase without application credentials', async t => {
  dockerEnvironment({ DOCKER_CONTEXT: 'rootless', DOCKER_HOST: 'ssh://ignored.example', SUPABASE_SECRET_KEY: 'synthetic-canary', GROQ_API_KEY: 'synthetic-canary' });
  const calls = await stubCommands(t, 'unix:///synthetic/run/docker.sock');
  const { command } = await commands();
  command('docker', ['network', 'ls']);
  // A context switch after validation must not move the following command.
  process.env.DOCKER_CONTEXT = 'remote';
  command('supabase', ['status', '--output', 'json']);
  assert.equal(calls.length, 3);
  const docker = calls[1].options.env;
  const supabase = calls[2].options.env;
  assert.deepEqual(docker, supabase);
  assert.equal(docker.DOCKER_HOST, 'unix:///synthetic/run/docker.sock');
  assert.equal(docker.HOME, '/synthetic/home');
  assert.equal(docker.DOCKER_CONFIG, '/synthetic/docker');
  assert.equal(docker.XDG_RUNTIME_DIR, '/synthetic/run');
  for (const name of ['DOCKER_CONTEXT', 'SUPABASE_SECRET_KEY', 'GROQ_API_KEY']) assert.equal(Object.hasOwn(docker, name), false);
});

test('invalid local endpoint forms fail closed', async t => {
  const calls = await stubCommands(t, '');
  for (const host of ['unix://remote/docker.sock', 'unix:///', 'unix:///tmp/docker.sock?target=remote', 'npipe:////./pipe/docker_engine']) {
    dockerEnvironment({ DOCKER_HOST: host });
    const { command } = await commands();
    assert.throws(() => command('supabase', ['start']), /LOCAL_DOCKER_REQUIRED/);
  }
  assert.equal(calls.length, 0);
});

test('registered environment check preserves the validated rootless connection across its subprocess', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'padalapocket-docker-test-'));
  const record = join(directory, 'observed.json');
  const socket = `unix://${directory}/docker.sock`;
  try {
    await writeFile(join(directory, 'docker'), `#!${process.execPath}\nif (process.argv[2] === 'context' && process.argv[3] === 'inspect') { console.log(${JSON.stringify(JSON.stringify(socket))}); } else { process.exit(1); }\n`, { mode: 0o700 });
    await writeFile(join(directory, 'supabase'), `#!${process.execPath}\nimport {writeFileSync} from 'node:fs';\nwriteFileSync(${JSON.stringify(record)}, JSON.stringify({local:process.env.DOCKER_HOST===${JSON.stringify(socket)}, home:process.env.HOME===${JSON.stringify(directory)}, config:process.env.DOCKER_CONFIG===${JSON.stringify(directory)}, runtime:process.env.XDG_RUNTIME_DIR===${JSON.stringify(directory)}, context:Object.hasOwn(process.env,'DOCKER_CONTEXT'), secret:Object.hasOwn(process.env,'SUPABASE_SECRET_KEY')}));\nprocess.exit(1);\n`, { mode: 0o700 });
    const result = childProcess.spawnSync(process.execPath, ['scripts/verify-backend.mjs', 'environment'], {
      cwd: new URL('../../../', import.meta.url), encoding: 'utf8',
      env: { PATH: `${directory}:${original.PATH}`, HOME: directory, DOCKER_CONFIG: directory, XDG_RUNTIME_DIR: directory, DOCKER_CONTEXT: 'rootless', SUPABASE_SECRET_KEY: 'synthetic-canary' },
    });
    // Deliberately failing status fixture: this is not live environment acceptance.
    assert.equal(result.status, 1);
    assert.deepEqual(JSON.parse(await readFile(record, 'utf8')), { local: true, home: true, config: true, runtime: true, context: false, secret: false });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
