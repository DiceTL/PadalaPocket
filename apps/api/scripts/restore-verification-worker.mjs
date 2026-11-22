import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { Keypair } from '@stellar/stellar-sdk';

try {
  const { container, cluster, mode, actor, family, other, address, message } = JSON.parse(readFileSync(0, 'utf8'));
  assert.match(container, /^[0-9a-f]{64}$/);
  assert.ok(['source', 'target'].includes(cluster));
  assert.ok(mode === 'sign' || (cluster === 'target' && mode === 'wrong-root'));
  for (const value of [actor, family, other]) assert.match(value, /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/);
  assert.match(address, /^G[A-Z2-7]{55}$/);
  assert.match(message, /^[0-9a-f]{64}$/);
  const lookup = (user, role, network, version) =>
    `wallet_custody.resolve_family_signing_seed('${user}','${family}','${role}','${network}','${address}',${version})`;
  const correct = lookup(actor, 'parent', 'testnet', 1);
  const query = statement => execFileSync('docker', ['exec', '-i', container, 'psql', '-XqAt', '-h', `/tmp/${cluster}`,
    '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
    input: `set role family_custody_worker;\n${statement}`, encoding: 'utf8', timeout: 7000, stdio: ['pipe', 'pipe', 'pipe'],
  }).trim();

  if (mode === 'wrong-root') {
    // Vault reports a data exception when ciphertext authentication fails.
    assert.throws(() => query(`\\set VERBOSITY verbose\nselect ${correct} is not null;`), error =>
      error.status === 3 && /ERROR:\s+22000:/.test(error.stderr ?? ''));
    console.log('decrypt-denied');
  } else {
    const wrong = [lookup(other, 'parent', 'testnet', 1), lookup(actor, 'agent', 'testnet', 1),
      lookup(actor, 'parent', 'mainnet', 1), lookup(actor, 'parent', 'testnet', 2),
      correct.replace(address, Keypair.random().publicKey())];
    assert.equal(query(`select ${wrong.map(expression => `${expression} is null`).join(' and ')};`), 't');
    const signer = Keypair.fromSecret(query(`select ${correct};`));
    assert.equal(signer.publicKey(), address);
    process.stdout.write(signer.sign(Buffer.from(message, 'hex')).toString('hex'));
  }
} catch {
  process.exitCode = 1; // Do not emit SQL output, fixture seed, or provider errors.
}
