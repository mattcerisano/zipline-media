import { describe, it, expect } from 'vitest';
import {
  normalizeEmail,
  normalizePhone,
  nameKey,
  compareNames,
  compareContacts,
  findDuplicateGroups,
  findMatchesFor,
  pairKey,
  planMerge,
  type DuplicateCandidate,
} from './duplicate-contacts';

const contact = (over: Partial<DuplicateCandidate> & { id: string; name: string }): DuplicateCandidate => ({
  email: '', phone: '', is_favorite: false, ...over,
});

describe('normalizeEmail', () => {
  it('folds case, plus-tags, and Gmail dots to one mailbox', () => {
    expect(normalizeEmail('John.Smith+crew@Gmail.com')).toBe('johnsmith@gmail.com');
    expect(normalizeEmail('john.smith@zipline.co')).toBe('john.smith@zipline.co');
  });

  it('treats the placeholders the importer invents as no email at all', () => {
    expect(normalizeEmail('john.smith@temporary.com')).toBe('');
    expect(normalizeEmail('')).toBe('');
    expect(normalizeEmail('not-an-email')).toBe('');
  });
});

describe('normalizePhone', () => {
  it('reduces any formatting to the last ten digits', () => {
    expect(normalizePhone('(555) 010-2233')).toBe('5550102233');
    expect(normalizePhone('+1 555 010 2233')).toBe('5550102233');
    expect(normalizePhone('555.010.2233')).toBe('5550102233');
  });

  it('ignores fragments too short to identify anyone', () => {
    expect(normalizePhone('x2233')).toBe('');
    expect(normalizePhone('')).toBe('');
  });
});

describe('compareNames', () => {
  it('matches through case, punctuation, order, and middle initials', () => {
    expect(compareNames('John Smith', 'john smith')).toBe('exact');
    expect(compareNames('Smith, John', 'John Smith')).toBe('exact');
    expect(compareNames('Dr. John A. Smith Jr.', 'John Smith')).toBe('exact');
    expect(compareNames('José Álvarez', 'Jose Alvarez')).toBe('exact');
  });

  it('folds short forms into the name they stand for', () => {
    expect(compareNames('Mike Alvarez', 'Michael Alvarez')).toBe('nickname');
    expect(nameKey('Mike Alvarez')).toBe(nameKey('Michael Alvarez'));
  });

  it('catches typos and initialled first names', () => {
    expect(compareNames('Jon Smith', 'John Smith')).toBe('variant');
    expect(compareNames('J Smith', 'John Smith')).toBe('variant');
    expect(compareNames('Ana Sanchez', 'Ana Sanchz')).toBe('variant');
    expect(compareNames('Marcus Web', 'Marcus Webb')).toBe('variant');
  });

  it('leaves genuinely different people alone', () => {
    expect(compareNames('John Smith', 'Sarah Chen')).toBeNull();
    expect(compareNames('John Smith', 'John Baker')).toBeNull();
    expect(compareNames('', 'John Smith')).toBeNull();
  });
});

describe('compareContacts', () => {
  it('calls a shared email a strong match even under different names', () => {
    const match = compareContacts(
      contact({ id: '1', name: 'J. Smith', email: 'js@zipline.co' }),
      contact({ id: '2', name: 'Johnny Smith Productions', email: 'JS@zipline.co' }),
    );
    expect(match?.strength).toBe('high');
    expect(match?.reasons[0]).toContain('Same email');
  });

  it('matches on a shared phone however it was typed', () => {
    const match = compareContacts(
      contact({ id: '1', name: 'Ana Ruiz', phone: '(555) 010-2233' }),
      contact({ id: '2', name: 'Ana Ruiz', phone: '+15550102233' }),
    );
    expect(match?.strength).toBe('high');
    expect(match?.reasons.some(r => r.startsWith('Same phone'))).toBe(true);
  });

  it('backs off when an identical name comes with details that disagree', () => {
    const match = compareContacts(
      contact({ id: '1', name: 'Chris Lee', email: 'chris@one.com', phone: '5550001111' }),
      contact({ id: '2', name: 'Chris Lee', email: 'chris@two.com', phone: '5552223333' }),
    );
    expect(match?.strength).toBe('medium');
  });

  it('drops a near-miss name when every other field disagrees', () => {
    expect(compareContacts(
      contact({ id: '1', name: 'Jon Smith', email: 'jon@one.com', phone: '5550001111' }),
      contact({ id: '2', name: 'John Smith', email: 'john@two.com', phone: '5552223333' }),
    )).toBeNull();
  });

  it('does not match two people who only share an employer', () => {
    expect(compareContacts(
      contact({ id: '1', name: 'Ana Ruiz', company_name: 'Lightyear' }),
      contact({ id: '2', name: 'Ben Cole', company_name: 'Lightyear' }),
    )).toBeNull();
  });

  it('does not match on a placeholder email alone', () => {
    expect(compareContacts(
      contact({ id: '1', name: 'Ana Ruiz', email: 'shared@temporary.com' }),
      contact({ id: '2', name: 'Ben Cole', email: 'shared@temporary.com' }),
    )).toBeNull();
  });
});

describe('findDuplicateGroups', () => {
  const roster = [
    contact({ id: 'a', name: 'Michael Alvarez', email: 'mike@lightyear.co', phone: '5550102233' }),
    contact({ id: 'b', name: 'Mike Alvarez', email: '', phone: '(555) 010-2233' }),
    contact({ id: 'c', name: 'Sarah Chen', email: 'sarah@chen.tv' }),
    contact({ id: 'd', name: 'Sarah Chen', email: 'sarah@chen.tv' }),
    contact({ id: 'e', name: 'Ben Cole', email: 'ben@cole.co' }),
  ];

  it('clusters the records that describe one person and leaves the rest', () => {
    const groups = findDuplicateGroups(roster);
    expect(groups).toHaveLength(2);
    const ids = groups.map(g => g.contacts.map(c => c.id).sort().join(''));
    expect(ids).toContain('ab');
    expect(ids).toContain('cd');
    expect(groups.every(g => g.strength === 'high')).toBe(true);
  });

  it('chains a three-way pile-up into a single group', () => {
    const groups = findDuplicateGroups([
      contact({ id: 'a', name: 'Ana Ruiz', email: 'ana@ruiz.co' }),
      contact({ id: 'b', name: 'Ana Ruiz', phone: '5550102233' }),
      contact({ id: 'c', name: 'A. Ruiz', email: 'ana@ruiz.co', phone: '5550102233' }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].contacts).toHaveLength(3);
  });

  it('honours pairs the user has marked as not duplicates', () => {
    const dismissed = [pairKey('c', 'd')];
    const groups = findDuplicateGroups(roster, dismissed);
    expect(groups.map(g => g.key)).toEqual(['a::b']);
  });

  it('returns nothing for a clean roster', () => {
    expect(findDuplicateGroups([roster[2], roster[4]])).toEqual([]);
  });

  it('stays fast on a full roster', () => {
    const many = Array.from({ length: 2000 }, (_, i) => contact({
      id: String(i),
      name: `Person ${i} Surname${i}`,
      email: `person${i}@zipline.co`,
      phone: String(5550000000 + i),
    }));
    const started = Date.now();
    expect(findDuplicateGroups(many)).toEqual([]);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});

describe('findMatchesFor', () => {
  it('warns about the record already on file before a second one is created', () => {
    const roster = [
      contact({ id: 'a', name: 'Michael Alvarez', email: 'mike@lightyear.co' }),
      contact({ id: 'b', name: 'Sarah Chen', email: 'sarah@chen.tv' }),
    ];
    const matches = findMatchesFor(contact({ id: '', name: 'Mike Alvarez' }), roster);
    expect(matches).toHaveLength(1);
    expect(matches[0].contact.id).toBe('a');
  });

  it('never matches a contact against itself while it is being edited', () => {
    const existing = contact({ id: 'a', name: 'Michael Alvarez', email: 'mike@lightyear.co' });
    expect(findMatchesFor(existing, [existing])).toEqual([]);
  });
});

describe('planMerge', () => {
  const group = [
    contact({
      id: 'keep', name: 'Michael Alvarez', email: 'mike@lightyear.co',
      primary_role: 'Gaffer', tags: 'LA', is_favorite: false, notes_general: 'Owns a van.',
    }),
    contact({
      id: 'drop', name: 'Mike Alvarez', phone: '5550102233', company_name: 'Lightyear',
      primary_role: 'Key Grip', secondary_roles: ['Electric'], tags: 'Union',
      is_favorite: true, notes_general: 'Prefers text.',
    }),
  ];

  it('fills the blanks on the surviving record without overwriting it', () => {
    const plan = planMerge(group, 'keep');
    expect(plan.removeIds).toEqual(['drop']);
    expect(plan.patch.phone).toBe('5550102233');
    expect(plan.patch.company_name).toBe('Lightyear');
    expect(plan.patch.email).toBeUndefined();
    expect(plan.patch.primary_role).toBeUndefined();
  });

  it('keeps every role, tag, note, and the star from either record', () => {
    const plan = planMerge(group, 'keep');
    expect(plan.patch.secondary_roles).toEqual(['Key Grip', 'Electric']);
    expect(plan.patch.tags).toBe('LA, Union');
    expect(plan.patch.notes_general).toBe('Owns a van.\n\nPrefers text.');
    expect(plan.patch.is_favorite).toBe(true);
    expect(plan.gained).toContain('phone');
  });

  it('merges the other way round just as well', () => {
    const plan = planMerge(group, 'drop');
    expect(plan.removeIds).toEqual(['keep']);
    expect(plan.patch.email).toBe('mike@lightyear.co');
    expect(plan.patch.secondary_roles).toEqual(['Electric', 'Gaffer']);
  });

  it('refuses to merge into a record outside the group', () => {
    expect(() => planMerge(group, 'nobody')).toThrow();
  });
});
