// Lightweight guard for the unauthenticated Maps proxy routes
// (/api/geocode, /api/hospital, /api/parking). These proxy Google Maps using a
// server-side key, so without any control they double as a free geocoding API
// anyone can hammer, running up the org's Maps bill.
//
// We can't do durable rate limiting on serverless without external state (KV),
// so the primary control is a same-origin check: the request must originate
// from our own site. It's not a perfect defense (Origin/Referer can be forged
// by a determined caller), but it stops the endpoints from being used as a
// public API by other sites and casual scripts. A per-request in-memory bucket
// adds a best-effort speed bump within a single warm instance.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 40;
const hits = new Map<string, { count: number; resetAt: number }>();

function hostOf(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host;
  } catch {
    return null;
  }
}

/**
 * Returns true when the request looks like it came from our own front-end.
 * Same-origin browser fetches always send an Origin or Referer header; requests
 * from other sites or bare scripts either omit them or carry a foreign host.
 */
export function isSameOrigin(request: Request): boolean {
  const selfHost = hostOf(request.url);
  const origin = hostOf(request.headers.get('origin'));
  const referer = hostOf(request.headers.get('referer'));

  // If neither header is present we can't confirm origin — reject.
  if (!origin && !referer) return false;
  if (origin && origin !== selfHost) return false;
  if (!origin && referer && referer !== selfHost) return false;
  return true;
}

/** Best-effort in-memory throttle. Keyed by client IP within a warm instance. */
export function withinRateLimit(request: Request): boolean {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown';
  const now = Date.now();
  const entry = hits.get(ip);
  if (!entry || now > entry.resetAt) {
    hits.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  entry.count += 1;
  return entry.count <= MAX_PER_WINDOW;
}
