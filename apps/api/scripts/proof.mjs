// Historical B-001 proof: observation only; no environment/journal mutation.
import { readFile, stat } from 'node:fs/promises';
import { createDependencies } from '../src/proof-sdk.mjs';
import { runProof } from '../src/proof.mjs';
try {
  const [command, action, hash] = process.argv.slice(2);
  if (command !== 'call' || !['snapshot', 'check', 'checkout', 'transaction', 'status'].includes(action)) throw Error('LEGACY_WRITER_RETIRED');
  if ((await stat('.env.local')).mode & 0o077) throw Error();
  if (action === 'transaction' && !/^[a-f0-9]{64}$/.test(hash ?? '')) throw Error();
  const deps = await createDependencies(process.env);
  let identity = {};
  if (action === 'status') {
    const path = '.env.b001-evidence.json';
    if ((await stat(path)).mode & 0o077) throw Error();
    const entries = JSON.parse(await readFile(path, 'utf8'));
    const record = entries.findLast(value => value.response?.gas?.requestId || value.response?.requestId);
    const saved = record?.response?.gas ?? record?.response;
    if (!saved?.requestId || !/^[a-f0-9]{64}$/.test(saved.transactionHash ?? '')) throw Error();
    identity = { requestId: saved.requestId, transactionHash: saved.transactionHash };
  }
  console.log(JSON.stringify(await runProof({ action, ...identity, ...(action === 'transaction' ? { transactionHash: hash } : {}) }, deps)));
} catch (error) {
  console.error(JSON.stringify({ error: error.message === 'LEGACY_WRITER_RETIRED' ? error.message : 'OBSERVATION_UNAVAILABLE' }));
  process.exitCode = 1;
}
