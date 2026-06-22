// Minimal service worker — enables PWA installability (Android/Chrome require a
// fetch handler) while staying network-first so users never see stale app code.
const CACHE = 'studio-os-v1';

self.addEventListener('install', () => {
  // Activate this worker immediately on first install.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Drop any old caches from previous versions.
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Only handle same-origin GET navigations/assets; let everything else pass through.
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    (async () => {
      try {
        // Network-first: always prefer fresh content.
        const fresh = await fetch(request);
        // Cache successful navigations/assets for offline fallback.
        if (fresh && fresh.status === 200 && request.url.startsWith('http')) {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        // Offline: fall back to cache, then to the app shell.
        const cached = await caches.match(request);
        if (cached) return cached;
        const shell = await caches.match('/command-center');
        if (shell) return shell;
        return new Response('Offline', { status: 503, statusText: 'Offline' });
      }
    })()
  );
});
