/* global offlineBuild */
const scope = new URL(self.registration.scope);
const cachePrefix = `lumibooth-shell:${scope.pathname}:`;
const cacheName = cachePrefix + offlineBuild.version;
const files = offlineBuild.files.map(file => new URL(file, scope).href);
const shell = new URL('index.html', scope).href;
const guestPage = /^(?:works(?:\/[^/]+)?|uploads|legal|backup|gallery|camera|editor|preview)?\/?$/;

self.addEventListener('install', event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(files)));
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith(cachePrefix) && key !== cacheName)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;
  if (request.mode === 'navigate' && !url.search && guestPage.test(url.pathname.slice(scope.pathname.length))) {
    event.respondWith(fetch(request).catch(async () => (await caches.open(cacheName)).match(shell)));
  } else if (url.href !== shell && files.includes(url.href)) {
    event.respondWith(caches.open(cacheName).then(async cache => (await cache.match(url.href, { ignoreVary: true })) ?? fetch(request)));
  }
});
