import { describe, it, expect } from 'vitest';
import {
  APP_ROLES,
  CONFIGURABLE_ROLES,
  canAccessTab,
  canUseWidget,
  defaultTabForRole,
  isScopedRole,
  seesOnlyOwnCards,
  widgetTypeOf,
} from './roles';

/**
 * The freelance-editor account is the case these rules exist for: an outside
 * contractor with a login to the studio's OS. Everything below is a way in that
 * has to stay shut — a shared tab layout, a saved panel, a search result — so
 * each is asserted rather than assumed.
 */

const EDITS_TAB = { id: 'edits', allowedRoles: ['admin', 'staff', 'client'] };
const VAULT_TAB = { id: 'vault', allowedRoles: ['admin', 'staff'] };

describe('canAccessTab', () => {
  it('gives a freelance editor the Edit Tracker and nothing else', () => {
    expect(canAccessTab('editor', EDITS_TAB)).toBe(true);
    expect(canAccessTab('editor', VAULT_TAB)).toBe(false);
    expect(canAccessTab('editor', { id: 'slate', allowedRoles: ['admin', 'staff', 'client'] })).toBe(false);
    expect(canAccessTab('editor', { id: 'rolodex', allowedRoles: ['admin'] })).toBe(false);
  });

  it('keeps the editor on the board even if the tab drops them from allowedRoles', () => {
    expect(canAccessTab('editor', { id: 'edits', allowedRoles: ['admin'] })).toBe(true);
  });

  it('does not let a custom tab hand the editor a second workspace', () => {
    // Custom tabs with no allowedRoles are open to everyone else.
    expect(canAccessTab('editor', { id: 'custom_1712345' })).toBe(false);
    expect(canAccessTab('staff', { id: 'custom_1712345' })).toBe(true);
  });

  it('leaves the configurable roles on their per-tab settings', () => {
    expect(canAccessTab('staff', VAULT_TAB)).toBe(true);
    expect(canAccessTab('client', VAULT_TAB)).toBe(false);
    expect(canAccessTab('client', EDITS_TAB)).toBe(true);
  });

  it('treats a signed-out or unknown role as having no configured access', () => {
    expect(canAccessTab(null, EDITS_TAB)).toBe(false);
    expect(canAccessTab(undefined, VAULT_TAB)).toBe(false);
  });
});

describe('canUseWidget', () => {
  it('lets the editor mount the board, including a job-bound card', () => {
    expect(canUseWidget('editor', 'edits')).toBe(true);
    expect(canUseWidget('editor', 'edits_job_9f0c1e6a-1111-2222-3333-444455556666')).toBe(true);
  });

  it('blocks widgets a saved panel layout might name', () => {
    expect(canUseWidget('editor', 'vault')).toBe(false);
    expect(canUseWidget('editor', 'rolodex')).toBe(false);
    expect(canUseWidget('editor', 'budget')).toBe(false);
    expect(canUseWidget('editor', 'inbox')).toBe(false);
    expect(canUseWidget('editor', 'slate_job_9f0c1e6a-1111-2222-3333-444455556666')).toBe(false);
    expect(canUseWidget('editor', 'embed_1712345')).toBe(false);
  });

  it('keeps the personal scratch pad, which a split panel falls back to', () => {
    expect(canUseWidget('editor', 'notes')).toBe(true);
  });

  it('does not restrict the configurable roles', () => {
    expect(canUseWidget('staff', 'vault')).toBe(true);
    expect(canUseWidget('client', 'slate')).toBe(true);
  });
});

describe('widgetTypeOf', () => {
  it('strips the job binding and the embed timestamp', () => {
    expect(widgetTypeOf('edits')).toBe('edits');
    expect(widgetTypeOf('gear_job_abc')).toBe('gear');
    expect(widgetTypeOf('embed_1712345')).toBe('embed');
  });
});

describe('defaultTabForRole', () => {
  it('lands each role somewhere it can actually go', () => {
    expect(defaultTabForRole('editor')).toBe('edits');
    expect(defaultTabForRole('admin')).toBe('dashboard');
    expect(defaultTabForRole('staff')).toBe('calendar');
    expect(defaultTabForRole('client')).toBe('calendar');
  });

  it('sends every role to a tab that role can access', () => {
    const tabs = [
      { id: 'dashboard', allowedRoles: ['admin'] },
      { id: 'calendar', allowedRoles: ['admin', 'staff', 'client'] },
      EDITS_TAB,
    ];
    for (const role of APP_ROLES) {
      const home = tabs.find(t => t.id === defaultTabForRole(role));
      expect(canAccessTab(role, home!)).toBe(true);
    }
  });
});

describe('seesOnlyOwnCards', () => {
  it('pins the freelance editor to their own queue', () => {
    expect(seesOnlyOwnCards('editor')).toBe(true);
  });

  it('leaves every other role seeing the whole board', () => {
    expect(seesOnlyOwnCards('admin')).toBe(false);
    expect(seesOnlyOwnCards('staff')).toBe(false);
    // A client is read-only on the tracker but still sees the studio's slate.
    expect(seesOnlyOwnCards('client')).toBe(false);
    expect(seesOnlyOwnCards(null)).toBe(false);
    expect(seesOnlyOwnCards(undefined)).toBe(false);
  });
});

describe('role lists', () => {
  it('offers the editor role in Settings → Team but not as a per-tab checkbox', () => {
    expect(APP_ROLES).toContain('editor');
    expect(CONFIGURABLE_ROLES).not.toContain('editor');
  });

  it('marks only the editor as scoped', () => {
    expect(isScopedRole('editor')).toBe(true);
    expect(CONFIGURABLE_ROLES.every(role => !isScopedRole(role))).toBe(true);
  });
});
