// Minimal service worker — enables PWA installability (Android/Chrome require a
// fetch handler) while staying network-first so users never see stale app code.
// Also displays web push notifications (call-time reminders, @mention pings).
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

// Web push → OS notification. Payloads are JSON: { title, body, url, tag }
// (see src/lib/push.ts). A push with no/unreadable payload still shows a
// generic notification — browsers require showing *something* for every push.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  event.waitUntil(
    self.registration.showNotification(data.title || 'Studio OS', {
      body: data.body || '',
      tag: data.tag || undefined,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url || '/command-center' },
    })
  );
});

// Tapping a notification focuses an open app window (navigating it to the
// target path) or opens a new one.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/command-center';
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows.find((c) => new URL(c.url).origin === self.location.origin);
      if (existing) {
        if ('navigate' in existing && new URL(existing.url).pathname !== url) {
          try { await existing.navigate(url); } catch { /* focus is still useful */ }
        }
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })()
  );
});
