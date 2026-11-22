// B-004's independent transfer writer is retired; observe its retained hash only.
import { readFile, stat } from 'node:fs/promises';
import { Horizon } from '@stellar/stellar-sdk';
try {
  const path = '.env.b004-anchor.json';
  if ((await stat(path)).mode & 0o077) throw Error();
  const state = JSON.parse(await readFile(path, 'utf8'));
  if (!/^[a-f0-9]{64}$/.test(state.transfer?.hash ?? '')) throw Error('LEGACY_WRITER_RETIRED');
  const horizon = new Horizon.Server('https://horizon-testnet.stellar.org');
  const result = await horizon.transactions().transaction(state.transfer.hash).call();
  console.log(JSON.stringify({ hash: result.hash, successful: result.successful, ledger: result.ledger }));
} catch (error) {
  console.error(JSON.stringify({ error: error.message === 'LEGACY_WRITER_RETIRED' ? error.message : 'OBSERVATION_UNAVAILABLE' }));
  process.exitCode = 1;
}
