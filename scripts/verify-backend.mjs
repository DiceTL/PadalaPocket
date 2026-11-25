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
  'money-journal': [['apps/api/scripts/verify-money-journal.mjs']],
  'dispatch-boundary': [['apps/api/scripts/verify-dispatch-boundary.mjs']],
  'recovery-boundary': [['apps/api/scripts/verify-recovery-boundary.mjs']],
  'writer-cutover': [
    ['--test', ...['money-authority','money-authority-bootstrap','money-coordinator-vercel','funding','purchases','weekly','proof','cap-exception','money-mapping','velo-topups','contract-baseline'].map(name=>`apps/api/test/${name}.test.mjs`)],
    ['apps/api/scripts/verify-writer-cutover-permissions-local.mjs'],
    ['apps/api/scripts/verify-writer-cutover-local.mjs'],
    ['apps/api/scripts/verify-writer-cutover.mjs'],
  ],
  'custody-access': [['apps/api/scripts/verify-custody-access.mjs']],
  'custody-restore': [['apps/api/scripts/verify-custody-restore.mjs']],
  'family-provision': [['apps/api/scripts/verify-family-provision.mjs']],
  'family-capacity': [['apps/api/scripts/verify-family-capacity.mjs']],
  'deposit-admission': [['apps/api/scripts/verify-deposit-admission.mjs']],
  'deposit-receipt': [['apps/api/scripts/verify-deposit-receipt.mjs']],
  'deposit-credit': [['apps/api/scripts/verify-deposit-credit.mjs']],
  'deposit-credit-route': [['apps/api/scripts/verify-deposit-credit-route.mjs']],
  'deposit-cancel': [['apps/api/scripts/verify-deposit-cancel.mjs']],
  'parent-balance': [['apps/api/scripts/verify-parent-balance.mjs']],
};
const [name, ...extra] = process.argv.slice(2);
if (!Object.hasOwn(checks, name) || extra.length) {
  console.error(`FAIL: expected one supported check: ${Object.keys(checks).join(', ')}`);
  process.exitCode = 1;
} else {
  // Checks receive no inherited credentials; live checks must opt into isolated access.
  let passed = false;
  try {
    const env = ['environment', 'money-journal', 'dispatch-boundary', 'recovery-boundary', 'writer-cutover', 'custody-access', 'custody-restore', 'family-provision', 'family-capacity', 'deposit-admission', 'deposit-receipt', 'deposit-credit', 'deposit-credit-route', 'deposit-cancel', 'parent-balance'].includes(name) ? localDockerEnvironment() : { PATH: process.env.PATH, NODE_ENV: 'test' };
    if (name === 'identity') {
      for (const key of ['HOME', 'SUPABASE_HOME', 'XDG_RUNTIME_DIR', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME', 'XDG_STATE_HOME', 'DBUS_SESSION_BUS_ADDRESS', 'T04_PARENT_EMAIL', 'T04_STUDENT_EMAIL', 'T04_SMTP_SENDER']) {
        if (process.env[key] !== undefined) env[key] = process.env[key];
      }
    }
    passed = checks[name].every(args => {
      const liveCutover = args[0] === 'apps/api/scripts/verify-writer-cutover.mjs';
      const childEnv = liveCutover ? { ...env } : env;
      if (liveCutover) {
        // Inject only the live probe's settings, never into local tests or fixtures.
        for (const key of ['MONEY_COORDINATOR_URL', 'MONEY_COORDINATOR_ACCESS_TOKEN', 'MONEY_COORDINATOR_GUARD_PUBLIC_KEY', 'OWNER_PUBLIC_KEY']) {
          if (process.env[key] !== undefined) childEnv[key] = process.env[key];
        }
      }
      const result = spawnSync(process.execPath, args, {
        cwd: root,
        env: childEnv,
        stdio: name === 'identity' ? ['inherit', 'pipe', 'pipe'] : 'pipe',
      });
      if ((liveCutover || ['dispatch-boundary', 'recovery-boundary', 'custody-access', 'custody-restore', 'family-provision', 'family-capacity', 'deposit-admission', 'deposit-receipt', 'deposit-credit', 'deposit-credit-route', 'deposit-cancel', 'parent-balance'].includes(name)) && result.status !== 0) process.stderr.write(result.stderr ?? '');
      return !result.error && result.status === 0;
    });
  } catch {
    // Connection validation failures must not expose command output or credentials.
  }
  console.log(`${passed ? 'PASS' : 'FAIL'}: ${name}`);
  process.exitCode = passed ? 0 : 1;
}
