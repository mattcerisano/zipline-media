// Who can see what.
//
// Most roles (admin / staff / client) are *configurable*: an admin picks which
// tabs each one sees via a tab's `allowedRoles`. Scoped roles are different —
// they exist to hand one outside person exactly one part of the OS, so their
// access is a fixed whitelist in code rather than a checkbox an admin could
// widen or narrow by accident.
//
// `editor` is the first of those: a freelance editor gets an account that opens
// straight onto the Edit Tracker and can do everything on that board (drag
// cards between stages, edit notes, labels, checklists, columns) — but the rest
// of the OS (Slate, Gear, Rolodex, Vault, Inbox, Budget, Library, Settings)
// simply is not reachable, whatever a saved or shared tab layout happens to say.

export type AppRole = 'admin' | 'staff' | 'client' | 'editor';

/** Roles an admin can hand out from Settings → Team. */
export const APP_ROLES: AppRole[] = ['admin', 'staff', 'client', 'editor'];

/** Roles that participate in per-tab `allowedRoles` configuration. */
export const CONFIGURABLE_ROLES: AppRole[] = ['admin', 'staff', 'client'];

export const ROLE_LABELS: Record<AppRole, string> = {
  admin: 'Admin',
  staff: 'Staff',
  client: 'Client',
  editor: 'Freelance Editor',
};

export const ROLE_HINTS: Record<AppRole, string> = {
  admin: 'Full access, settings & team management',
  staff: 'Everything except admin settings',
  client: 'Limited view (calendar, slate, tracker)',
  editor: 'Edit Tracker only — full editing on the board, nothing else',
};

interface ScopedRole {
  /** Command Center tab ids this role may open. */
  tabs: string[];
  /** Workspace widgets this role may mount inside those tabs. */
  widgets: string[];
  /** Tab they land on at sign-in. */
  home: string;
  /**
   * Board shows only cards assigned to them — a freelancer sees their own
   * queue, not the studio's slate. Matched on the account email against the
   * assigned Rolodex contact's email, and enforced in RLS as well as here.
   */
  ownCardsOnly?: boolean;
}

const SCOPED_ROLES: Partial<Record<AppRole, ScopedRole>> = {
  // 'notes' is the per-user scratch pad — it is what a split panel falls back
  // to, and holds nothing but the editor's own text, so it stays available.
  editor: { tabs: ['edits'], widgets: ['edits', 'notes'], home: 'edits', ownCardsOnly: true },
};

const scopeFor = (role: string | null | undefined): ScopedRole | undefined =>
  role ? SCOPED_ROLES[role as AppRole] : undefined;

/** True when the role's access is a fixed whitelist rather than tab config. */
export function isScopedRole(role: string | null | undefined): boolean {
  return !!scopeFor(role);
}

/**
 * Panel tab ids carry their widget type plus context: `edits_job_<uuid>` is the
 * Edit Tracker bound to one production, `embed_<timestamp>` an embedded site.
 */
export function widgetTypeOf(panelTabId: string): string {
  if (panelTabId.startsWith('embed_')) return 'embed';
  const boundAt = panelTabId.indexOf('_job_');
  return boundAt === -1 ? panelTabId : panelTabId.slice(0, boundAt);
}

/** Can this role open this Command Center tab? */
export function canAccessTab(
  role: string | null | undefined,
  tab: { id: string; allowedRoles?: readonly string[] }
): boolean {
  const scope = scopeFor(role);
  if (scope) return scope.tabs.includes(tab.id);
  if (!tab.allowedRoles) return true;
  return tab.allowedRoles.includes(role as string);
}

/** Can this role mount this widget in a workspace panel? */
export function canUseWidget(role: string | null | undefined, panelTabId: string): boolean {
  const scope = scopeFor(role);
  if (!scope) return true;
  return scope.widgets.includes(widgetTypeOf(panelTabId));
}

/**
 * Does this role see only the cards assigned to it?
 *
 * The UI filter this drives is a convenience, not the boundary: the boundary is
 * the RLS policy on `jobs` (20260814000000), which returns nothing else to an
 * editor's session in the first place.
 */
export function seesOnlyOwnCards(role: string | null | undefined): boolean {
  return !!scopeFor(role)?.ownCardsOnly;
}

/** The tab a freshly signed-in user of this role should land on. */
export function defaultTabForRole(role: string | null | undefined): string {
  const scope = scopeFor(role);
  if (scope) return scope.home;
  return role === 'admin' ? 'dashboard' : 'calendar';
}
