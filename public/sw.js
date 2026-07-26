// Studio OS service worker.
//
// Two jobs:
//   1. App shell — network-first with cache fallback, so the installed PWA opens
//      on a bad signal instead of the browser's offline page.
//   2. Production data — the Supabase reads behind call sheets, gear manifests,
//      and crew lists. Those are cross-origin, so they used to be skipped
//      entirely: on location the app would load from the shell cache and then
//      render empty panels, which reads as "the app is broken" rather than
//      "you're offline". The last successful response for each read is now kept
//      and replayed when the network is gone.
//
// Two deliberate non-goals:
//   - Writes are never cached or replayed. A save attempted offline fails, and
//     the UI says so. A silently queued call-sheet edit that lands hours later
//     is worse on a shoot day than an error at the moment you try.
//   - A read with no cached copy is not answered with an empty result. It fails
//     like any network error, so an uncached gear list can never render as a
//     confident "0 items" while someone is loading a truck.

const SHELL_CACHE = 'studio-os-v2';
const DATA_CACHE = 'studio-os-data-v1';
const KEEP = [SHELL_CACHE, DATA_CACHE];

// Written onto every cached data response so the UI can say how old the numbers
// on screen actually are.
const CACHED_AT = 'x-zipline-cached-at';

// The Supabase project origin, passed in at registration time (`/sw.js?data=…`).
// The hosted-domain test below is the fallback when it isn't supplied.
const CONFIGURED_DATA_ORIGIN =
  new URL(self.location.href).searchParams.get('data') || '';

// Only these tables are stored. An allowlist rather than a denylist: anything
// added later is non-cached until someone decides it belongs on a phone in a
// basement. Deliberately absent — google_tokens (OAuth refresh tokens),
// vault/vault_items/vault_meta (the secrets vault), and notification_channels
// (webhook URLs). None are needed to run a shoot day, and none should sit in a
// disk cache on a lost phone.
const CACHEABLE_TABLES = new Set([
  'jobs',
  'job_roles',
  'job_todos',
  'job_schedules',
  'job_shotlist',
  'job_scenes',
  'contacts',
  'clients',
  'projects',
  'inventory',
  'gear_templates',
  'production_notes',
  'organizations',
  'profiles',
]);

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((k) => !KEEP.includes(k)).map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Signing out drops every cached production record. Without this, the next
// person to sign in on a shared iPad could pull the previous user's jobs out of
// the cache while offline.
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'zipline-clear-data') {
    event.waitUntil(caches.delete(DATA_CACHE));
  }
});

function isDataRequest(url) {
  const matchesConfigured =
    CONFIGURED_DATA_ORIGIN && url.origin === CONFIGURED_DATA_ORIGIN;
  const isHostedSupabase = url.hostname.endsWith('.supabase.co');
  if (!matchesConfigured && !isHostedSupabase) return false;
  // PostgREST reads only. /auth/v1/* (sessions, tokens) is never cached.
  return url.pathname.startsWith('/rest/v1/');
}

function tableOf(url) {
  const match = url.pathname.match(/^\/rest\/v1\/([A-Za-z0-9_]+)/);
  return match ? match[1] : null;
}

async function broadcast(message) {
  const clients = await self.clients.matchAll({
    type: 'window',
    includeUncontrolled: true,
  });
  for (const client of clients) client.postMessage(message);
}

// Re-wraps a response with the time it was stored. The body has to be read out
// to build a new Response, hence the clone at the call site.
async function stamped(response) {
  const headers = new Headers(response.headers);
  headers.set(CACHED_AT, new Date().toISOString());
  return new Response(await response.blob(), {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleData(request) {
  const cache = await caches.open(DATA_CACHE);
  try {
    const fresh = await fetch(request);
    // Only 200s are worth keeping. A 401 from an expired token must not become
    // the cached answer for the rest of the shoot.
    if (fresh && fresh.status === 200) {
      await cache.put(request, await stamped(fresh.clone()));
      broadcast({ type: 'zipline-data-fresh', at: new Date().toISOString() });
    }
    return fresh;
  } catch (err) {
    const cached = await cache.match(request);
    if (cached) {
      broadcast({
        type: 'zipline-data-stale',
        cachedAt: cached.headers.get(CACHED_AT) || null,
      });
      return cached;
    }
    // Never seen this read before. Surface the network failure so the panel
    // shows its error state instead of a fabricated empty list.
    broadcast({ type: 'zipline-data-stale', cachedAt: null });
    throw err;
  }
}

async function handleShell(request) {
  try {
    const fresh = await fetch(request);
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(SHELL_CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    const shell = await caches.match('/command-center');
    if (shell) return shell;
    return new Response('Offline', { status: 503, statusText: 'Offline' });
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Writes and everything else non-GET go straight to the network, untouched.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (isDataRequest(url)) {
    const table = tableOf(url);
    if (!table || !CACHEABLE_TABLES.has(table)) return; // not on the allowlist
    event.respondWith(handleData(request));
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Authenticated JSON routes (mail, Google status, team) are left alone —
  // caching a mailbox to disk isn't part of running a shoot day, and stale
  // integration status is worse than none.
  if (url.pathname.startsWith('/api/')) return;

  event.respondWith(handleShell(request));
});
