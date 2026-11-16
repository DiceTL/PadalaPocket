import { spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { localDockerEnvironment } from './local-docker.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const checks = {
  'contract-baseline': [
    ['scripts/check-contracts.mjs'],
    ['--test', ...readdirSync(new URL('../apps/api/test/', import.meta.url))
      .filter(name => name.endsWith('.test.mjs'))
      .map(name => `apps/api/test/${name}`)],
  ],
  environment: [['apps/api/scripts/verify-environment.mjs']],
  'vision-access': [['apps/api/scripts/verify-vision-access.mjs']],
  identity: [['apps/api/scripts/verify-account-delivery.mjs']],
};
const [name, ...extra] = process.argv.slice(2);
if (!Object.hasOwn(checks, name) || extra.length) {
  console.error(`FAIL: expected one supported check: ${Object.keys(checks).join(', ')}`);
  process.exitCode = 1;
} else {
  // Checks receive no inherited credentials; live checks must opt into isolated access.
  let passed = false;
  try {
    const env = name === 'environment' ? localDockerEnvironment() : { PATH: process.env.PATH, NODE_ENV: 'test' };
    if (name === 'identity') {
      for (const key of ['HOME', 'SUPABASE_HOME', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'DBUS_SESSION_BUS_ADDRESS', 'T04_PARENT_EMAIL', 'T04_STUDENT_EMAIL', 'T04_SMTP_SENDER']) {
        if (process.env[key] !== undefined) env[key] = process.env[key];
      }
    }
    passed = checks[name].every(args => {
      const result = spawnSync(process.execPath, args, {
        cwd: root,
        env,
        stdio: name === 'identity' ? ['inherit', 'pipe', 'pipe'] : 'pipe',
      });
      return !result.error && result.status === 0;
    });
  } catch {
    // Connection validation failures must not expose command output or credentials.
  }
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
  process.exitCode = passed ? 0 : 1;
}
