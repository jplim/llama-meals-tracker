const CACHE_VERSION = 'v3';
const CACHE_NAME = `meals-tracker-${CACHE_VERSION}`;

const PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/icon-maskable-512.png',
  '/apple-touch-icon.png',
];

// Install: pre-cache core shell assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean up old version caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch: Network-first for API, Stale-While-Revalidate for static assets
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Never intercept non-GET or API requests — always go to network
  if (request.method !== 'GET' || request.url.includes('/api/')) {
    return;
  }

  // For navigation requests (HTML pages), use network-first with cache fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
          return res;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // For static assets: Stale-While-Revalidate
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((networkRes) => {
        if (networkRes.status === 200) {
          const clone = networkRes.clone();
          caches.open(CACHE_NAME).then((c) => c.put(request, clone));
        }
        return networkRes;
      }).catch(() => null);

      return cached || networkFetch;
    })
  );
});
