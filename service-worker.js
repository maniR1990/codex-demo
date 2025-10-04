const CACHE_NAME = 'wealth-accelerator-static-v1';
const ASSETS = [
  '/',
  '/index.html',
  '/src/main.js',
  '/src/store.js',
  '/src/views.js',
  '/src/utils.js',
  '/src/encryption.js',
  '/src/indexeddb.js',
  '/src/styles.css',
  '/public/icon.svg',
  '/public/app.webmanifest'
];

async function precacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  await cache.addAll(ASSETS);
}

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(precacheAssets());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

async function updateCache(request) {
  try {
    const response = await fetch(request, { cache: 'no-store' });
    if (response && response.ok) {
      const cache = await caches.open(CACHE_NAME);
      await cache.put(request, response.clone());
    }
  } catch (error) {
    // network fetch failed; ignore to keep using cached response
  }
}

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  const { request } = event;
  const url = new URL(request.url);

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          event.waitUntil(
            caches.open(CACHE_NAME).then((cache) => cache.put('/index.html', copy)).catch(() => undefined)
          );
          return response;
        })
        .catch(async () => (await caches.match('/index.html')) ?? Response.error())
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        event.waitUntil(updateCache(request));
        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            event.waitUntil(
              caches
                .open(CACHE_NAME)
                .then((cache) => cache.put(request, copy))
                .catch(() => undefined)
            );
          }
          return response;
        })
        .catch(async () => {
          if (url.origin === self.location.origin) {
            const fallback = await caches.match(url.pathname);
            if (fallback) {
              return fallback;
            }
            return (await caches.match('/index.html')) ?? Response.error();
          }
          return Response.error();
        });
    })
  );
});
