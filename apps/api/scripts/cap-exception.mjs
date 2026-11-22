// Historical B-002 evidence is read-only after T08; no init, funding or dispatch.
import { readFile, stat } from 'node:fs/promises';
import { NoirAgentClient } from '@noirx402/agent-sdk';
try {
  if (process.argv[2] !== 'observe') throw Error('LEGACY_WRITER_RETIRED');
  const path = '.env.b002-state.json';
  if ((await stat(path)).mode & 0o077) throw Error('PRIVATE_JOURNAL_REQUIRED');
  const state = JSON.parse(await readFile(path, 'utf8'));
  const noir = new NoirAgentClient({ network: 'testnet' });
  noir.server.httpClient.defaults.timeout = 15000;
  for (const [step, entry] of Object.entries(state.steps)) if (/^[a-f0-9]{64}$/.test(entry.hash ?? '')) {
    const result = await noir.server.getTransaction(entry.hash);
    console.log(JSON.stringify({ step, hash: entry.hash, ledgerStatus: result.status }));
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.message === 'LEGACY_WRITER_RETIRED' ? error.message : 'OBSERVATION_UNAVAILABLE' }));
  process.exitCode = 1;
}
