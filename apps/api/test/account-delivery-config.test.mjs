import { test } from 'node:test';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import { syncBuiltinESMExports } from 'node:module';
import * as context from '../scripts/account-delivery-context.mjs';

const result = changes => ({ status: 0, stdout: 'Configuration diff\n' + JSON.stringify({ changes }) });
const redirects = { path: ['auth', 'additional_redirect_urls'], class: 'remote_only', declared: false, remote: ['https://padalapocket.vercel.app', 'http://127.0.0.1:5174'] };
const sender = 'approved-sender@example.test';
const smtp = [
  { path: ['auth', 'email', 'smtp', 'enabled'], class: 'remote_only', declared: false, remote: true },
  { path: ['auth', 'email', 'smtp', 'host'], class: 'remote_only', declared: false, remote: 'smtp.gmail.com' },
  { path: ['auth', 'email', 'smtp', 'admin_email'], class: 'remote_only', declared: false, remote: sender },
];

test('identity configuration accepts preserved SMTP and redirects without requiring unrelated settings to match', () => {
  assert.doesNotThrow(() => context.validateIdentityConfiguration(result([redirects, ...smtp]), sender));
});

test('identity configuration rejects declared drift, missing production redirects and invalid CLI responses', () => {
  for (const value of [
    result([redirects, ...smtp, { path: ['auth', 'site_url'], class: 'update', declared: true }]),
    result([{ ...redirects, remote: ['http://127.0.0.1:5174'] }, ...smtp]),
    { status: 1, stdout: JSON.stringify({ changes: [redirects, ...smtp] }) },
    { status: 0, stdout: 'invalid response' },
  ]) assert.throws(() => context.validateIdentityConfiguration(value, sender));
});

test('configuration verification reads machine output even when the CLI defaults to colored human output', t => {
  const previousSender = process.env.T04_SMTP_SENDER;
  process.env.T04_SMTP_SENDER = sender;
  t.mock.method(childProcess, 'spawnSync', (_program, args) => ({
    status: 0,
    stdout: args.includes('--output-format') && args[args.indexOf('--output-format') + 1] === 'json'
      ? result([redirects, ...smtp]).stdout
      : '\x1b[33mAuth configuration differences\x1b[0m',
  }));
  syncBuiltinESMExports();
  try {
    assert.doesNotThrow(() => context.canonicalSiteConfiguration('a'.repeat(20)));
  } finally {
    t.mock.restoreAll();
    syncBuiltinESMExports();
    if (previousSender === undefined) delete process.env.T04_SMTP_SENDER;
    else process.env.T04_SMTP_SENDER = previousSender;
  }
});

test('identity configuration rejects disabled, missing or changed approved SMTP settings', () => {
  for (let index = 0; index < smtp.length; index++) {
    const missing = smtp.filter((_, position) => position !== index);
    assert.throws(() => context.validateIdentityConfiguration(result([redirects, ...missing]), sender));
    const changed = smtp.map((field, position) => position === index ? { ...field, remote: index === 0 ? false : 'unexpected.example.test' } : field);
    assert.throws(() => context.validateIdentityConfiguration(result([redirects, ...changed]), sender));
  }
  assert.throws(() => context.validateIdentityConfiguration(result([redirects, ...smtp])));
});
