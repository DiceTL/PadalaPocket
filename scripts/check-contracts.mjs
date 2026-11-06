import { readFile, readdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { validateSuite } from '../handoff/api-examples/validate.mjs';
const files = (await readdir(new URL('../handoff/api-examples/', import.meta.url))).filter(name => name.endsWith('.json'));
if (files.length !== 1 || files[0] !== 'cases.json') throw new Error('Keep all validated JSON cases in cases.json');
const fixtures = JSON.parse(await readFile(new URL('../handoff/api-examples/cases.json', import.meta.url), 'utf8'));
validateSuite(fixtures);
console.log(`Validated ${fixtures.length} MOCK API examples (s002-v1); no live endpoint compatibility claimed.`);
execFileSync(process.execPath, ['--test', new URL('../handoff/api-examples/validate.test.mjs', import.meta.url).pathname], { stdio: 'inherit' });
