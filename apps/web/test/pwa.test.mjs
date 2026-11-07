import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('PWA worker caches only public fallback and bypasses API, photos and mutations', async () => {
  const source = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
  const listeners = {}, added = [];
  const fallback = new Response('offline');
  vm.runInNewContext(source, {
    self: { location: { origin: 'https://app.test' }, addEventListener: (name, fn) => listeners[name] = fn },
    URL, Request: class extends Request { constructor(url, options) { super(new URL(url, 'https://app.test'), options); } }, Response, fetch: async () => { throw Error('offline'); },
    caches: { open: async () => ({ add: r => added.push(r.url) }), match: async () => fallback },
  });
  let pending;
  listeners.install({ waitUntil: p => pending = p });
  // Node requires absolute Request URLs; the browser resolves /offline.html against the worker origin.
  await pending;
  assert.deepEqual(added, ['https://app.test/offline.html']);
  for (const [path, method, mode] of [ ['/api/purchases','GET','navigate'], ['/api','GET','navigate'], ['/photo','GET','cors'], ['/api/purchases','POST','cors'], ['/assets/app.js','GET','cors'] ]) {
    let intercepted = false;
    listeners.fetch({ request: { url: 'https://app.test' + path, method, mode }, respondWith: () => intercepted = true });
    assert.equal(intercepted, false, path);
  }
  let response;
  listeners.fetch({ request: { url: 'https://app.test/', method: 'GET', mode: 'navigate' }, respondWith: p => response = p });
  assert.equal(await response, fallback);
});
