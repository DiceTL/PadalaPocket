import { readdir } from 'node:fs/promises';
// S-002 supplies fixture validation. Do not mistake an empty fixture set for passing contracts.
try {
  const files = await readdir(new URL('../handoff/api-examples/', import.meta.url));
  if (files.some(file => file.endsWith('.json'))) {
    throw new Error('JSON API fixtures require the S-002 validator before they can pass CI');
  }
} catch (error) {
  if (error.code !== 'ENOENT') throw error;
}
console.log('Contract checks: not applicable in S-001; no API fixtures yet. Implement in S-002.');
