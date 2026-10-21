/**
 * The studio owner's address.
 *
 * Admin checks read user_roles, but the owner predates that table and can be
 * missing from it — the login path (command-center) has always let this address
 * through on its own. Server routes that gate on "is this an administrator"
 * mirror that bypass, and they have to mirror the *same* address, so it lives
 * here rather than being re-typed per route.
 *
 * It comes from the OWNER_EMAIL environment variable (see .env.example and
 * docs/INSTALL_NEW_STUDIO.md). Unset, there is no bypass: every admin has to
 * have a user_roles row, which supabase/install/first_admin.sql creates.
 *
 * Server-side only: nothing here should be imported into a client component.
 * The login screen reads the same value through NEXT_PUBLIC_OWNER_EMAIL, which
 * next.config.ts fills from OWNER_EMAIL at build time.
 */
export const OWNER_EMAIL = (process.env.OWNER_EMAIL || '').trim().toLowerCase();

/** True for the owner's own account, whatever user_roles says. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!OWNER_EMAIL && !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
