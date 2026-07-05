import crypto from 'crypto';

// HMAC-signed OAuth `state` so the Google callback can trust the user id it
// carries. Previously `state` was just the raw userId, so anyone could hit the
// callback (or the start URL) with an arbitrary id and bind Google tokens to
// another user's account. The state is now `userId.timestamp.signature`, and
// the callback rejects anything it didn't sign or that has expired.

// A dedicated secret is preferred, but fall back to the service-role key (which
// is always present server-side) so no new env var is strictly required.
const SECRET =
  process.env.OAUTH_STATE_SECRET ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'insecure-dev-only-secret';

const MAX_AGE_MS = 10 * 60 * 1000; // state is single-use within 10 minutes

function sign(payload: string): string {
  return crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
}

export function signOAuthState(userId: string): string {
  const payload = `${userId}.${Date.now()}`;
  return `${payload}.${sign(payload)}`;
}

/**
 * Verify a signed state and return the embedded user id, or null if the state
 * is malformed, tampered with, or older than MAX_AGE_MS.
 */
export function verifyOAuthState(state: string | null | undefined): string | null {
  if (!state) return null;
  const parts = state.split('.');
  if (parts.length !== 3) return null;
  const [userId, ts, sig] = parts;
  const payload = `${userId}.${ts}`;

  const expected = sign(payload);
  // Constant-time compare to avoid leaking signature bytes via timing.
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  const age = Date.now() - Number(ts);
  if (!Number.isFinite(age) || age < 0 || age > MAX_AGE_MS) return null;

  return userId || null;
}
