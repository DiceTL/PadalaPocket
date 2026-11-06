import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Asset, Networks, Keypair } from '@stellar/stellar-sdk';
import { approvalBytes, approvedOperation } from '../src/cap-exception.mjs';

test('owner approval binds every exception field; modified, expired and unrelated approvals fail', () => {
  const owner = Keypair.random();
  const key = () => Keypair.random().publicKey();
  const r = { id: 'a'.repeat(32), owner: owner.publicKey(), deviceHash: 'b'.repeat(64), agent: key(), merchant: key(), asset: Asset.native().contractId(Networks.TESTNET),
    amountStroops: '11000000', nonce: '1', bucket: 'needs', photoReference: 'synthetic:b002-photo-v1', expiresAt: '2030-01-01T00:00:00.000Z' };
  const signature = owner.sign(approvalBytes(r)).toString('base64');
  assert.equal(approvedOperation(r, signature, owner.publicKey()).amount, 11_000_000n);
  for (const [field, value] of Object.entries(r)) {
    const replacement = ['owner', 'agent', 'merchant', 'asset'].includes(field) ? key() : field === 'expiresAt' ? '2031-01-01T00:00:00Z' : field === 'bucket' ? 'wants' : value + '1';
    assert.throws(() => approvedOperation({ ...r, [field]: replacement }, signature, owner.publicKey()), field);
  }
  assert.throws(() => approvedOperation(r, signature, key()));
  assert.throws(() => approvedOperation(r, signature, owner.publicKey(), Date.parse(r.expiresAt)));
  assert.throws(() => approvedOperation({ ...r, extra: 'ignored?' }, signature, owner.publicKey()));
  assert.throws(() => approvedOperation(r, Keypair.random().sign(approvalBytes(r)).toString('base64'), owner.publicKey()));
});

test('CLI initialization is exclusive, private and does not reveal signing material', async () => {
  const { mkdtemp, writeFile, readFile, stat } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join, resolve } = await import('node:path');
  const { spawnSync } = await import('node:child_process');
  const cwd = await mkdtemp(join(tmpdir(), 'b002-'));
  const secrets = { OWNER_SECRET: Keypair.random().secret(), AGENT_SECRET: Keypair.random().secret(), MERCHANT_SECRET: Keypair.random().secret() };
  await writeFile(join(cwd, '.env.local'), '', { mode: 0o600 });
  const script = resolve(import.meta.dirname, '../scripts/cap-exception.mjs');
  const run = () => spawnSync(process.execPath, [script, 'init'], { cwd, env: { ...process.env, ...secrets }, encoding: 'utf8' });
  const first = run();
  assert.equal(first.status, 0, first.stdout);
  const path = join(cwd, '.env.b002-state.json');
  const original = await readFile(path, 'utf8');
  assert.equal((await stat(path)).mode & 0o077, 0);
  assert.equal(run().status, 1);
  assert.equal(await readFile(path, 'utf8'), original);
  for (const secret of [...Object.values(secrets), JSON.parse(original).exceptionSecret]) assert.ok(!first.stdout.includes(secret));
});
