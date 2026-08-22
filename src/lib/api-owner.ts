/**
 * The studio owner's address.
 *
 * Admin checks read user_roles, but the owner predates that table and can be
 * missing from it — the login path (command-center) has always let this address
 * through on its own. Server routes that gate on "is this an administrator"
 * mirror that bypass, and they have to mirror the *same* address, so it lives
 * here rather than being re-typed per route.
 *
 * Server-side only: nothing here should be imported into a client component.
 */
export const OWNER_EMAIL = 'matt@zipline.media';

/** True for the owner's own account, whatever user_roles says. */
export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === OWNER_EMAIL;
}
