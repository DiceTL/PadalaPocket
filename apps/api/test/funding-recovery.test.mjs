import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { closeInterruptedSetup } from '../src/funding-recovery.mjs';
import { funding } from '../src/funding.mjs';
import { createMoneyWriters } from '../src/money-writers.mjs';
const forbidden = new Proxy({}, { get() { assert.fail('Recovery accessed an external capability'); } });
const attempt = () => closeInterruptedSetup({ db: forbidden, noir: forbidden, operationId: 'op', writersStopped: true });
const response = () => ({ setHeader() {}, end(raw) { this.body = JSON.parse(raw); } });

test('recovery racing with an active writer cannot close or overwrite its journal', async () => {
  const row = { status: 'processing', steps: { device: { hash: 'registration' } } };
  let releaseWriter;
  const writer = new Promise(resolve => { releaseWriter = resolve; }).then(() => {
    row.steps.fund = { hash: 'original-funding-hash', signed: 'original-envelope' };
  });
  await assert.rejects(attempt(), /RECOVERY_DISABLED_NO_DISPATCH_FENCE/);
  assert.equal(row.status, 'processing');
  releaseWriter(); await writer;
  assert.equal(row.status, 'processing'); assert.equal(row.steps.fund.hash, 'original-funding-hash');
});

test('after recovery is attempted, an interrupted same-key writer cannot resume dispatch', async () => {
  const row = { id: 'op', family_id: 'family', coordinator_version: 0, created_at: '2026-11-20T00:00:00Z', status: 'unknown', steps: { device: { hash: 'registration', signed: 'envelope' } }, amount_stroops: '10000000' };
  const snapshot = structuredClone(row);
  await assert.rejects(attempt(), /RECOVERY_DISABLED_NO_DISPATCH_FENCE/);
  const query = { select() { return this; }, eq() { return this; }, maybeSingle: async () => ({ data: row }) };
  let dispatches = 0;
  const writers = createMoneyWriters({
    database: new Proxy({}, { get() { dispatches++; assert.fail('Historical funding reached the coordinator journal'); } }),
    activatedAt: '2026-11-21T00:00:00Z',
  });
  const res = response();
  await funding({ method: 'POST', headers: { 'idempotency-key': '8de9b1e9-bb2b-4f7d-886e-86f588b769f6' }, body: { priceMinor: '968' } }, res, {
    authenticate: async () => ({ member: { role: 'parent', family_id: 'family', user_id: 'parent' } }),
    database: () => ({ from: () => query }),
    writers,
    ledger: () => ({ server: { httpClient: { defaults: {} } }, prepare() { dispatches++; throw Error('Unexpected prepare'); }, submit() { dispatches++; throw Error('Unexpected submit'); } }),
  });
  assert.equal(res.statusCode, 200); assert.equal(res.body.status, 'unknown');
  assert.equal(dispatches, 0); assert.deepEqual(row, snapshot);
});

test('even drained writers and terminal registration cannot authorize closure without an enforced fence', async () => {
  for (const registrationStatus of ['SUCCESS', 'FAILED', 'NOT_FOUND']) {
    await assert.rejects(closeInterruptedSetup({ db: forbidden, noir: forbidden, writersStopped: true, activeWriters: 0, registrationStatus }), /RECOVERY_DISABLED_NO_DISPATCH_FENCE/);
  }
});

test('CLI refuses old attestation arguments and never requires credentials', () => {
  const result = spawnSync(process.execPath, ['apps/api/scripts/recover-funding-setup.mjs', '8de9b1e9-bb2b-4f7d-886e-86f588b769f6', '--writers-stopped-and-drained'], {
    cwd: new URL('../../../', import.meta.url), encoding: 'utf8', env: { PATH: process.env.PATH },
  });
  assert.equal(result.status, 1); assert.equal(result.stdout, '');
  assert.match(result.stderr, /Recovery disabled/);
});
