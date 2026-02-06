// service worker file

// current cache version, update to invalidate old caches
const CACHE_NAME = 'openWings-cache-v1';

// Install a set of common assets to cache for offline use
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([
        '/',
        '/login',
        '/register',
        '/profile',
        '/static/entry.js',
        '/static/login.css',
        '/static/profile.css',
        '/static/utils.css',
      ]);
    })
  );
});

// update the cache with new assets when the service worker is activated
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            // delete old caches that don't match the current version
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Intercept fetch requests and serve cached assets when available
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      return cachedResponse || fetch(event.request);
    })
  );
});