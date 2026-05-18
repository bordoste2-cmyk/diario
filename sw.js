// Health Diary - Service Worker
// Update the version number when you change app code to force refresh
const CACHE_NAME = 'diario-v1.2.1';
const ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

// External hosts we should NEVER cache (live data, can fail offline)
const NETWORK_ONLY_HOSTS = [
  'world.openfoodfacts.org',
  'world.openfoodfacts.net'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(err => {
      console.warn('Cache addAll failed, some assets may be missing:', err);
    }))
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-only for Open Food Facts API (always live)
  if (NETWORK_ONLY_HOSTS.includes(url.hostname)) {
    event.respondWith(fetch(req).catch(() => new Response(
      JSON.stringify({ error: 'offline', status: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    )));
    return;
  }

  // Network-first for HTML so updates propagate; cache-first for everything else
  if (req.mode === 'navigate' || req.destination === 'document') {
    event.respondWith(
      fetch(req).then(res => {
        const copy = res.clone();
        caches.open(CACHE_NAME).then(c => c.put(req, copy));
        return res;
      }).catch(() => caches.match(req).then(r => r || caches.match('./index.html')))
    );
    return;
  }

  // Cache-first for other resources (including ZXing CDN once loaded)
  event.respondWith(
    caches.match(req).then(cached => {
      if (cached) return cached;
      return fetch(req).then(res => {
        // Cache successful responses (including CORS-able CDN resources)
        if (res.ok && (req.url.startsWith(self.location.origin) || res.type === 'basic' || res.type === 'cors')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
