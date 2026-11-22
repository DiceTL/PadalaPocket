// Historical B-004 sessions are observation-only after T08; no authentication signing or initiation.
import { readFile, stat } from 'node:fs/promises';
try {
  const command = process.argv[2];
  if (!['status', 'history'].includes(command)) throw Error('LEGACY_WRITER_RETIRED');
  const path = '.env.b004-anchor.json';
  if ((await stat(path)).mode & 0o077) throw Error();
  const state = JSON.parse(await readFile(path, 'utf8'));
  if (!state.token || command === 'status' && !state.id) throw Error();
  const endpoint = command === 'history' ? '/transactions?asset_code=native' : '/transaction?id=' + encodeURIComponent(state.id);
  const response = await fetch('https://testanchor.stellar.org/sep24' + endpoint, {
    headers: { Authorization: 'Bearer ' + state.token }, redirect: 'error', signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error();
  const result = await response.json();
  if (command === 'status') {
    if (result.transaction?.id !== state.id) throw Error();
    console.log(JSON.stringify({ id: state.id, status: result.transaction.status, authenticated: true }));
  } else {
    if (!Array.isArray(result.transactions)) throw Error();
    console.log(JSON.stringify({ authenticated: true, transactions: result.transactions.map(value => ({ id: value.id, kind: value.kind, status: value.status })) }));
  }
} catch (error) {
  console.error(JSON.stringify({ error: error.message === 'LEGACY_WRITER_RETIRED' ? error.message : 'OBSERVATION_UNAVAILABLE' }));
  process.exitCode = 1;
}
