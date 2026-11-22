// Historical B-003 journals remain intact; all former init/run writers are retired.
import { readFile, stat } from 'node:fs/promises';
import { NoirAgentClient } from '@noirx402/agent-sdk';
try {
  const command = process.argv[2];
  if (!['observe', 'observe-buckets'].includes(command)) throw Error('LEGACY_WRITER_RETIRED');
  const path = command === 'observe-buckets' ? '.env.b003-buckets.json' : '.env.b003-state.json';
  if ((await stat(path)).mode & 0o077) throw Error('PRIVATE_JOURNAL_REQUIRED');
  const state = JSON.parse(await readFile(path, 'utf8'));
  const noir = new NoirAgentClient({ network: 'testnet' });
  noir.server.httpClient.defaults.timeout = 15000;
  for (const [step, entry] of Object.entries(state.steps)) if (/^[a-f0-9]{64}$/.test(entry.hash ?? '')) {
    const result = await noir.server.getTransaction(entry.hash);
    console.log(JSON.stringify({ step, hash: entry.hash, ledgerStatus: result.status }));
  }
  const buckets = {};
  for (const [name, hash] of Object.entries(state.buckets ?? {})) buckets[name] = (await noir.getEscrowBalance(hash)).toString();
  console.log(JSON.stringify({ buckets, allowance: (await noir.getEscrowBalance(state.allowance)).toString(),
    private: (await noir.getEscrowBalance(state.private)).toString(), pending: (await noir.getPendingBalance(state.merchant)).toString() }));
} catch (error) {
  console.error(JSON.stringify({ error: error.message === 'LEGACY_WRITER_RETIRED' ? error.message : 'OBSERVATION_UNAVAILABLE' }));
  process.exitCode = 1;
}
