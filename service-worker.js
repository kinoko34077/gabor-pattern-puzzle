/* オフライン配信用ファイル。現在のインストール先の配信スコープに限定する。 */
const CACHE = 'gabor-pattern-puzzle-v2';
const CORE = [
  './', './index.html', './manifest.webmanifest',
  './dist/gabor.js', './dist/palette.js', './dist/layout.js', './dist/game.js', './dist/render.js', './dist/main.js',
  './icons/icon-192.png', './icons/icon-512.png',
  './icons/maskable-192.png', './icons/maskable-512.png'
];
const url = rel => new URL(rel, self.registration.scope).href;
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(CORE.map(url));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('gabor-pattern-puzzle-') && key !== CACHE)
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const target = new URL(event.request.url);
  if (target.origin !== self.location.origin || !target.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const res = await fetch(event.request);
        if (res.ok) return res;
      } catch { /* オフライン時はキャッシュへ切り替える */ }
      const cache = await caches.open(CACHE);
      return await cache.match(url('./index.html')) || Response.error();
    })());
  } else {
    event.respondWith((async () => {
      const cached = await caches.match(event.request);
      if (cached) return cached;
      const fresh = await fetch(event.request);
      return fresh;
    })());
  }
});
