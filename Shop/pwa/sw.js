/* StyleMint Shop service worker (contract A7). Template: pwa/swPlugin.ts injects the precache list.
 * - Precaches the app shell only (index.html, hashed assets, offline page, manifest, icons).
 * - `/v1/*` and `/payments/*` are network-only (never touched here).
 * - Navigations under /shop/: network first, then the cached shell, then the offline page.
 * - Images: stale-while-revalidate, capped at 60 entries.
 * - No push, no background sync.
 */
const VERSION = '__SHOP_VERSION__';
const SHELL = 'sm-shop-shell-' + VERSION;
const IMAGES = 'sm-shop-img';
const MAX_IMAGES = 60;
const PRECACHE = self.__SHOP_PRECACHE__;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('sm-shop-shell-') && k !== SHELL).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function trimImages() {
  const cache = await caches.open(IMAGES);
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - MAX_IMAGES; i++) await cache.delete(keys[i]);
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  if (sameOrigin && (url.pathname.startsWith('/v1/') || url.pathname.startsWith('/payments/'))) return;

  if (req.mode === 'navigate') {
    if (!sameOrigin || !url.pathname.startsWith('/shop/')) return;
    event.respondWith(
      fetch(req).catch(async () => (await caches.match('/shop/')) || (await caches.match('/shop/offline.html')) || Response.error()),
    );
    return;
  }

  if (sameOrigin && url.pathname.startsWith('/shop/assets/')) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
    return;
  }

  if (req.destination === 'image') {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const hit = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone()).then(trimImages);
            return res;
          })
          .catch(() => hit);
        return hit || network;
      }),
    );
    return;
  }

  if (sameOrigin && PRECACHE.includes(url.pathname)) {
    event.respondWith(caches.match(req).then((hit) => hit || fetch(req)));
  }
});
