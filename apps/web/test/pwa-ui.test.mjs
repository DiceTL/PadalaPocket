import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Minimal browser doubles exercise the real event handlers without adding a DOM library.
class Surface {
  children = [];
  hidden = false;
  handlers = new Map();
  append(...nodes) { this.children.push(...nodes); }
  prepend(node) { this.children.unshift(node); }
  setAttribute() {}
  addEventListener(name, handler) { this.handlers.set(name, handler); }
  async fire(name, event = {}) { await this.handlers.get(name)?.(event); }
}

test('install failures recover, installed tools hide, and update notices remain singular', async () => {
  const window = new Surface(), body = new Surface();
  const registration = new Surface();
  registration.installing = new Surface();
  registration.waiting = null;
  const navigator = { onLine: true, serviceWorker: { controller: {}, register: async () => registration } };
  const source = await readFile(new URL('../src/pwa.js', import.meta.url), 'utf8');
  vm.runInNewContext(source.replace('export function', 'function') + '\nsetupPwa();', {
    document: { body, createElement: () => new Surface() },
    window, navigator, matchMedia: () => Object.assign(new Surface(), { matches: false }),
  });
  await new Promise(resolve => setImmediate(resolve));
  const panel = body.children[0];
  const [notice, install, help, update] = panel.children;
  assert.equal(panel.hidden, false);
  const offer = async (prompt, userChoice) => window.fire('beforeinstallprompt', { preventDefault() {}, prompt, userChoice });
  await offer(async () => { throw Error('blocked'); }, Promise.resolve({ outcome: 'dismissed' }));
  await install.fire('click');
  assert.match(help.textContent, /installation prompt could not open/);
  assert.equal(help.hidden, false);
  assert.equal(install.disabled, false);
  await offer(async () => {}, { then: (_resolve, reject) => reject(Error('choice failed')) });
  await install.fire('click');
  assert.equal(help.hidden, false);
  assert.equal(install.disabled, false);
  await window.fire('appinstalled');
  assert.equal(panel.hidden, true);
  navigator.onLine = false;
  await window.fire('offline');
  assert.equal(notice.hidden, false);
  assert.equal(install.hidden, true);
  assert.equal(panel.hidden, false);
  navigator.onLine = true;
  await window.fire('online');
  assert.equal(panel.hidden, true);
  registration.waiting = {};
  await registration.fire('updatefound');
  await registration.installing.fire('statechange');
  await registration.installing.fire('statechange');
  assert.equal(panel.children.length, 4);
  assert.equal(update.hidden, false);
  assert.equal(panel.hidden, false);
});
