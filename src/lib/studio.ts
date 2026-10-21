/**
 * Who this deployment belongs to.
 *
 * Studio OS was written for one studio, and its name, owner and home town
 * were typed into the code. A second production company runs the same code
 * on its own Vercel and Supabase projects, so everything that names the
 * studio now comes from environment variables. Every knob defaults to the
 * original values: a deployment that sets nothing behaves exactly as before.
 *
 * Safe to import from client components — everything here is public
 * (NEXT_PUBLIC_*, inlined at build time). The owner's address for server-side
 * admin checks lives in api-owner.ts, which reads the private OWNER_EMAIL;
 * next.config.ts mirrors that one value into NEXT_PUBLIC_OWNER_EMAIL so the
 * login screen can apply the same bypass without a second variable to set.
 *
 * See docs/INSTALL_NEW_STUDIO.md for the full list.
 */

const DEFAULT_NAME = 'Zipline Media';

/** The studio's name, as it appears on the login screen and in exports. */
export const STUDIO_NAME = (process.env.NEXT_PUBLIC_STUDIO_NAME || '').trim() || DEFAULT_NAME;

/** True when nothing was configured — the original studio's deployment. */
export const IS_DEFAULT_STUDIO = STUDIO_NAME === DEFAULT_NAME;

/**
 * "Zipline Studio OS" has always been the product's own name on the original
 * deployment (PWA title, calendar footers); another studio gets its name in
 * front instead.
 */
export const STUDIO_OS_NAME = IS_DEFAULT_STUDIO ? 'Zipline Studio OS' : `${STUDIO_NAME} Studio OS`;

/**
 * The owner's sign-in address, for the login bypass that lets the person who
 * set the deployment up in before any user_roles row exists. Empty when
 * OWNER_EMAIL is unset — then only accounts listed under Settings → Team get in.
 */
export const OWNER_EMAIL_PUBLIC = (process.env.NEXT_PUBLIC_OWNER_EMAIL || '').trim().toLowerCase();

/** The studio's mail domain, for placeholders and "is this one of us?" checks. */
export const STUDIO_EMAIL_DOMAIN =
  (process.env.NEXT_PUBLIC_STUDIO_EMAIL_DOMAIN || '').trim().toLowerCase() ||
  (OWNER_EMAIL_PUBLIC.includes('@') ? OWNER_EMAIL_PUBLIC.split('@')[1] : '') ||
  'zipline.media';

/** Where the Locations map sits before it has any pins. */
export const STUDIO_HOME: { lat: number; lng: number } = parseLatLng(process.env.NEXT_PUBLIC_STUDIO_HOME) ?? {
  lat: 40.7549,
  lng: -73.984,
};

/** "40.7549,-73.984" → coordinates, or null for anything that isn't a pair. */
export function parseLatLng(value: string | undefined | null): { lat: number; lng: number } | null {
  const parts = (value || '').split(',').map((p) => Number(p.trim()));
  if (parts.length !== 2 || parts.some((n) => !Number.isFinite(n))) return null;
  const [lat, lng] = parts;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

/** "Zipline Media" → "zipline-media", for filenames. */
export function studioSlug(name: string = STUDIO_NAME): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'studio';
}
