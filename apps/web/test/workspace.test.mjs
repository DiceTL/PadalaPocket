import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import config from '../vite.config.js';
test('development API requests use the same-origin API prefix', () => {
  assert.equal(config.server.proxy['/api'], 'http://127.0.0.1:3001');
});
test('workspace entry has language, charset and viewport without product UI', async () => {
  const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(html, /lang="en"/);
  assert.match(html, /charset="UTF-8"/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /<body><\/body>/);
});
