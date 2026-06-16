const TILE_CACHE_NAME = 'tiles-cache-v1';

// Intercept only local proxy tile requests to avoid CORS / mixed-content issues.
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/tiles/')) {
    event.respondWith(
      caches.open(TILE_CACHE_NAME).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }
          return fetch(event.request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(() => {
            return getFallbackTile(event.request, cache);
          });
        });
      })
    );
  }
});

async function getFallbackTile(request, cache) {
  const url = new URL(request.url);
  const parts = url.pathname.split('/');
  // /api/tiles/{z}/{x}/{y}.png
  const z = parseInt(parts[3]);
  const x = parseInt(parts[4]);
  const y = parseInt(parts[5].split('.')[0]);

  for (let lowerZ = z - 1; lowerZ >= 0; lowerZ--) {
    const lowerX = Math.floor(x / Math.pow(2, z - lowerZ));
    const lowerY = Math.floor(y / Math.pow(2, z - lowerZ));
    const fallbackRequest = new Request(`/api/tiles/${lowerZ}/${lowerX}/${lowerY}.png`);
    const cached = await cache.match(fallbackRequest);
    if (cached) {
      return cached;
    }
  }

  return new Response('', { status: 404 });
}

// Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== TILE_CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
