// Bump the version when changing the public offline document.
const CACHE = 'padalapocket-offline-v1';
const OFFLINE = '/offline.html';
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.add(new Request(OFFLINE, { cache: 'reload' }))));
});
// Let new workers wait until old app windows close. Never interrupt a payment.
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key.startsWith('padalapocket-offline-') && key !== CACHE).map(key => caches.delete(key))
  )));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || event.request.mode !== 'navigate' ||
      url.origin !== self.location.origin || url.pathname === '/api' || url.pathname.startsWith('/api/')) return;
  event.respondWith(fetch(event.request, { cache: 'no-store' }).catch(async () =>
    (await caches.match(OFFLINE, { cacheName: CACHE })) || Response.error()
  ));
});
