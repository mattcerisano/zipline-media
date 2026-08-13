/**
 * Crew roles.
 *
 * A contact used to have exactly one role, `primary_role`, and everything that
 * needed to know what someone does read that single field. On a small crew
 * that is wrong more often than it is right: the same person cuts, shoots, and
 * produces depending on the job. The practical damage was that assigning an
 * edit required setting someone's primary role to "Editor", which then billed
 * them as the editor on every call sheet they appeared on.
 *
 * Contacts now carry `secondary_roles` alongside the primary one. The primary
 * stays the headline — what they're listed as by default — and the secondary
 * roles are the other hats, used for "who can do X" lookups and offered when
 * building a call sheet.
 */

export interface RoleBearing {
  primary_role?: string | null;
  secondary_roles?: string[] | null;
}

/** Roles that can be assigned an edit in the tracker. */
export const POST_ROLES = [
  'Editor',
  'Assistant Editor',
  'Colorist',
  'Motion Graphics',
  'Animator',
  'Sound Designer',
  'Composer',
];

/**
 * Every role a contact holds, primary first, de-duplicated case-insensitively
 * and with blanks dropped.
 */
export function contactRoles(contact: RoleBearing | null | undefined): string[] {
  if (!contact) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  const push = (role: string | null | undefined) => {
    const trimmed = (role || '').trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    out.push(trimmed);
  };

  push(contact.primary_role);
  for (const role of contact.secondary_roles || []) push(role);
  return out;
}

/**
 * Break a role into the jobs it names.
 *
 * Imported rosters are full of compound titles — "Director - Editor",
 * "Composer/Music Producer", "Gaffer & Key Grip" — written into the single
 * role field there used to be. Splitting them means an existing contact
 * answers "who edits?" without anyone having to re-key their roles first.
 */
export function roleTokens(role: string | null | undefined): string[] {
  return (role || '')
    .split(/[/,|&]|\s+-\s+|\s+\+\s+|\s+and\s+/i)
    .map(part => part.trim())
    .filter(Boolean);
}

/** Case-insensitive test: does this contact hold any of `targets`? */
export function hasAnyRole(contact: RoleBearing | null | undefined, targets: string[]): boolean {
  const wanted = new Set(targets.map(t => t.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return false;
  for (const role of contactRoles(contact)) {
    if (wanted.has(role.toLowerCase())) return true;
    for (const token of roleTokens(role)) {
      if (wanted.has(token.toLowerCase())) return true;
    }
  }
  return false;
}

/** Parse typed or imported role text ("Editor; Producer") into a clean list. */
export function parseRoleList(value: string | null | undefined): string[] {
  if (!value) return [];
  const out: string[] = [];
  const seen = new Set<string>();
  for (const part of value.split(/[;,|\n]/)) {
    const role = part.trim();
    if (!role) continue;
    const key = role.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(role);
  }
  return out;
}

/** Render a role list for an input box. */
export function formatRoleList(roles: string[] | null | undefined): string {
  return (roles || []).filter(Boolean).join(', ');
}

/**
 * Normalise a contact's roles for saving: the primary is never repeated in the
 * secondary list, so "Editor" can't show up twice on a call sheet picker.
 */
export function normalizeSecondaryRoles(
  secondary: string[] | null | undefined,
  primary: string | null | undefined,
): string[] {
  const primaryKey = (primary || '').trim().toLowerCase();
  const out: string[] = [];
  const seen = new Set<string>();
  for (const role of secondary || []) {
    const trimmed = (role || '').trim();
    if (!trimmed) continue;
    const key = trimmed.toLowerCase();
    if (key === primaryKey || seen.has(key)) continue;
    seen.add(key);
    out.push(trimmed);
  }
  return out;
}
