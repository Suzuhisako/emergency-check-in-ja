const CACHE_NAME = 'family-board-v3';

// Add any CDN links (Bootstrap CSS/JS, Fonts) if hosted externally!
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
  // 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css',
  // 'https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js'
];

// ------------------------------------------------------------------
// 1. Install Event: Pre-cache App Shell
// ------------------------------------------------------------------
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use addAll, but catch errors to prevent whole SW failing if an icon is missing
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[SW] Pre-cache warning (some assets may be missing):', err);
      });
    })
  );
});

// ------------------------------------------------------------------
// 2. Activate Event: Wipe Legacy Caches & Claim Clients
// ------------------------------------------------------------------
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

// ------------------------------------------------------------------
// 3. Fetch Event: Cache-First for Instant Offline Speed
// ------------------------------------------------------------------
self.addEventListener('fetch', (event) => {
  // Only handle standard GET HTTP(S) requests
  if (event.request.method !== 'GET') return;
  if (!event.request.url.startsWith('http')) return;

  // A. Navigation Requests (Loading HTML / App Shell)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      caches.match('./index.html')
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Serve cached HTML instantly, update cache in background if online
            fetch(event.request).then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
              }
            }).catch(() => {/* Ignore background network failure */});

            return cachedResponse;
          }

          // Fallback if index.html wasn't pre-cached under exact key
          return fetch(event.request);
        })
        .catch(async () => {
          // Robust multi-fallback promise resolution
          const fallback = await caches.match('./index.html') 
                        || await caches.match('./') 
                        || await caches.match('/');
          return fallback;
        })
    );
    return;
  }

  // B. Asset & Static Resource Requests (Cache First, Network Fallback)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;

      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || (networkResponse.status !== 200 && networkResponse.type !== 'opaque')) {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

// ------------------------------------------------------------------
// 4. Message Listener: Instant Skip Waiting
// ------------------------------------------------------------------
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});