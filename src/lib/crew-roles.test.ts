import { describe, it, expect } from 'vitest';
import {
  contactRoles,
  roleTokens,
  hasAnyRole,
  parseRoleList,
  formatRoleList,
  normalizeSecondaryRoles,
  POST_ROLES,
} from './crew-roles';

describe('contactRoles', () => {
  it('lists the primary role first, then the secondary ones', () => {
    expect(contactRoles({ primary_role: 'Producer', secondary_roles: ['Editor', 'Gaffer'] }))
      .toEqual(['Producer', 'Editor', 'Gaffer']);
  });

  it('de-duplicates case-insensitively and drops blanks', () => {
    expect(contactRoles({ primary_role: 'Producer', secondary_roles: ['producer', '  ', 'Editor'] }))
      .toEqual(['Producer', 'Editor']);
  });

  it('copes with a contact carrying neither field', () => {
    expect(contactRoles({})).toEqual([]);
    expect(contactRoles(null)).toEqual([]);
  });
});

describe('roleTokens', () => {
  it('splits the compound titles imported rosters are full of', () => {
    expect(roleTokens('Director - Editor')).toEqual(['Director', 'Editor']);
    expect(roleTokens('Composer/Music Producer')).toEqual(['Composer', 'Music Producer']);
    expect(roleTokens('Gaffer & Key Grip')).toEqual(['Gaffer', 'Key Grip']);
  });

  it('leaves a role that merely contains a hyphen or "and" alone', () => {
    expect(roleTokens('Director of Photography')).toEqual(['Director of Photography']);
    expect(roleTokens('1st AC')).toEqual(['1st AC']);
  });
});

describe('hasAnyRole', () => {
  it('matches a secondary role, which is the whole point', () => {
    const tommy = { primary_role: 'Producer', secondary_roles: ['Editor'] };
    expect(hasAnyRole(tommy, POST_ROLES)).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(hasAnyRole({ primary_role: 'editor' }, ['Editor'])).toBe(true);
  });

  it('matches inside a compound title, so old data needs no re-keying', () => {
    expect(hasAnyRole({ primary_role: 'Director - Editor' }, POST_ROLES)).toBe(true);
  });

  it('is false for someone who holds none of them', () => {
    expect(hasAnyRole({ primary_role: 'Gaffer', secondary_roles: ['Key Grip'] }, POST_ROLES)).toBe(false);
    expect(hasAnyRole({ primary_role: 'Editor' }, [])).toBe(false);
  });
});

describe('parseRoleList / formatRoleList', () => {
  it('parses separated role text', () => {
    expect(parseRoleList('Editor, Producer; Colorist')).toEqual(['Editor', 'Producer', 'Colorist']);
  });

  it('drops blanks and repeats', () => {
    expect(parseRoleList('Editor, , editor')).toEqual(['Editor']);
    expect(parseRoleList('')).toEqual([]);
  });

  it('round-trips through the input format', () => {
    expect(parseRoleList(formatRoleList(['Editor', 'Producer']))).toEqual(['Editor', 'Producer']);
  });
});

describe('normalizeSecondaryRoles', () => {
  it('never repeats the primary role', () => {
    expect(normalizeSecondaryRoles(['Producer', 'Editor'], 'producer')).toEqual(['Editor']);
  });

  it('trims, de-duplicates, and drops empties', () => {
    expect(normalizeSecondaryRoles([' Editor ', 'editor', ''], 'Producer')).toEqual(['Editor']);
    expect(normalizeSecondaryRoles(null, 'Producer')).toEqual([]);
  });
});
