/**
 * Duplicate detection for the rolodex.
 *
 * A roster gets duplicates the same three ways every time: the same phone
 * exports its contacts twice, a QuickBooks or CSV import lands on top of
 * people who are already in here, and someone types "Mike Alvarez" for the
 * "Michael Alvarez" they couldn't find. None of that is caught by the
 * database, which only enforces unique emails — and half the crew is saved
 * with a placeholder email anyway.
 *
 * So the matching lives here, as pure functions over contact records: no
 * Supabase, no React. The component decides how to show a match; this file
 * only decides what counts as one, and how confident it is.
 *
 * Nothing here ever deletes anything. A match is a suggestion the user
 * confirms — merging is a separate, explicit step (see `planMerge`).
 */

/** The shape of a contact this module needs. `Contact` satisfies it. */
export interface DuplicateCandidate {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  company_name?: string | null;
  primary_role?: string | null;
  secondary_roles?: string[] | null;
  location_city?: string | null;
  location_state?: string | null;
  location_country?: string | null;
  tags?: string | null;
  notes_general?: string | null;
  is_favorite?: boolean | null;
}

export type MatchStrength = 'high' | 'medium' | 'low';

export interface DuplicateMatch {
  strength: MatchStrength;
  /** Human-readable, in the order they should be shown. */
  reasons: string[];
}

export interface DuplicateGroup {
  /** Stable id for the group — the sorted contact ids, joined. */
  key: string;
  contacts: DuplicateCandidate[];
  strength: MatchStrength;
  reasons: string[];
}

/**
 * Emails the app itself invents when an import has none — matching on these
 * would just be matching on the name a second time, with false confidence.
 */
const PLACEHOLDER_EMAIL_DOMAINS = ['temporary.com', 'example.com', 'noemail.com', 'no-email.com'];

const HONORIFICS = new Set(['mr', 'mrs', 'ms', 'miss', 'dr', 'prof', 'sir']);
const SUFFIXES = new Set(['jr', 'sr', 'ii', 'iii', 'iv', 'phd', 'md']);

/** Short forms that show up on set. Both sides map to the same canonical key. */
const NICKNAMES: Record<string, string> = {
  abby: 'abigail', al: 'albert', alex: 'alexander', alexandra: 'alexander', ali: 'alison',
  andy: 'andrew', angie: 'angela', ann: 'anne', anna: 'anne', becky: 'rebecca', ben: 'benjamin',
  beth: 'elizabeth', bill: 'william', billy: 'william', bob: 'robert', bobby: 'robert',
  brad: 'bradley', cathy: 'catherine', charlie: 'charles', chris: 'christopher',
  chrissy: 'christine', chuck: 'charles', cindy: 'cynthia', dan: 'daniel', danny: 'daniel',
  dave: 'david', deb: 'deborah', debbie: 'deborah', dick: 'richard', don: 'donald',
  doug: 'douglas', ed: 'edward', eddie: 'edward', ellie: 'eleanor', fran: 'frances',
  frank: 'franklin', fred: 'frederick', gabe: 'gabriel', greg: 'gregory', hank: 'henry',
  jack: 'john', jake: 'jacob', jen: 'jennifer', jenny: 'jennifer', jerry: 'gerald',
  jess: 'jessica', jim: 'james', jimmy: 'james', joe: 'joseph', joey: 'joseph',
  josh: 'joshua', kate: 'katherine', katie: 'katherine', kathy: 'katherine', ken: 'kenneth',
  kim: 'kimberly', larry: 'lawrence', len: 'leonard', liz: 'elizabeth', lizzy: 'elizabeth',
  lou: 'louis', maggie: 'margaret', matt: 'matthew', meg: 'margaret', meli: 'melissa',
  mel: 'melvin', mick: 'michael', mike: 'michael', mitch: 'mitchell', nate: 'nathaniel',
  nick: 'nicholas', pat: 'patrick', patty: 'patricia', paul: 'paul', pete: 'peter',
  phil: 'philip', ray: 'raymond', rich: 'richard', rick: 'richard', rob: 'robert',
  robby: 'robert', ron: 'ronald', ross: 'ross', russ: 'russell', sam: 'samuel',
  sandy: 'sandra', steve: 'steven', stephen: 'steven', sue: 'susan', susie: 'susan',
  ted: 'theodore', terry: 'terrence', tim: 'timothy', tom: 'thomas', tommy: 'thomas',
  tony: 'anthony', vicky: 'victoria', vince: 'vincent', walt: 'walter', will: 'william',
  zach: 'zachary',
};

/**
 * An email reduced to the mailbox it actually reaches: case folded, plus-tags
 * dropped, and Gmail's ignored dots removed. Placeholders return '' — they are
 * not evidence of anything.
 */
export function normalizeEmail(email: string | null | undefined): string {
  const raw = (email || '').trim().toLowerCase();
  if (!raw || !raw.includes('@')) return '';
  const [localRaw, domain] = raw.split('@');
  if (!localRaw || !domain) return '';
  if (PLACEHOLDER_EMAIL_DOMAINS.includes(domain)) return '';
  let local = localRaw.split('+')[0];
  if (domain === 'gmail.com' || domain === 'googlemail.com') local = local.replace(/\./g, '');
  if (!local) return '';
  return `${local}@${domain}`;
}

/**
 * A phone reduced to its last ten digits — the part that stays the same
 * whether it was saved as "(555) 010-2233", "+1 555 010 2233", or
 * "555.010.2233". Anything shorter is an extension or a fragment, not a
 * number we can match on.
 */
export function normalizePhone(phone: string | null | undefined): string {
  const digits = (phone || '').replace(/\D/g, '');
  if (digits.length < 10) return '';
  return digits.slice(-10);
}

/** Lowercased, de-accented, punctuation-free name text. */
export function normalizeName(name: string | null | undefined): string {
  return (name || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * The name as parts worth comparing: honorifics, suffixes, and middle
 * initials dropped, so "Dr. John A. Smith Jr." and "john smith" line up.
 */
export function nameTokens(name: string | null | undefined): string[] {
  return normalizeName(name)
    .split(' ')
    .filter(t => t && !HONORIFICS.has(t) && !SUFFIXES.has(t))
    // A middle initial is noise; a *leading* one is the whole first name we
    // were given ("J Smith"), so it stays.
    .filter((t, i) => i === 0 || t.length > 1);
}

/** Nickname-folded, order-independent key. "Smith, Mike" === "Michael Smith". */
export function nameKey(name: string | null | undefined): string {
  return nameTokens(name)
    .map(t => NICKNAMES[t] || t)
    .sort()
    .join(' ');
}

/** Edit distance, abandoned once it passes `max` — we only care about typos. */
function editDistance(a: string, b: string, max = 2): number {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    let best = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      row.push(value);
      if (value < best) best = value;
    }
    if (best > max) return max + 1;
    prev = row;
  }
  return prev[b.length];
}

export type NameMatch = 'exact' | 'nickname' | 'variant' | null;

/**
 * How alike two names are.
 *
 * - `exact`    — the same name once case, punctuation and middle initials go.
 * - `nickname` — the same name through a short form ("Mike" / "Michael").
 * - `variant`  — a plausible typo or an initialled first name: same surname
 *                with a one-character difference up front, or vice versa.
 */
export function compareNames(a: string | null | undefined, b: string | null | undefined): NameMatch {
  const tokensA = nameTokens(a);
  const tokensB = nameTokens(b);
  if (tokensA.length === 0 || tokensB.length === 0) return null;

  const plainA = [...tokensA].sort().join(' ');
  const plainB = [...tokensB].sort().join(' ');
  if (plainA === plainB) return 'exact';
  if (nameKey(a) === nameKey(b)) return 'nickname';

  // Beyond here we compare the two ends of the name: a shared surname with a
  // near-miss first name is the shape a typo or a re-import takes.
  const firstA = tokensA[0];
  const firstB = tokensB[0];
  const lastA = tokensA[tokensA.length - 1];
  const lastB = tokensB[tokensB.length - 1];
  if (tokensA.length < 2 || tokensB.length < 2) return null;

  const canonFirstA = NICKNAMES[firstA] || firstA;
  const canonFirstB = NICKNAMES[firstB] || firstB;

  if (lastA === lastB) {
    if (canonFirstA === canonFirstB) return 'variant';
    if (editDistance(canonFirstA, canonFirstB, 1) <= 1) return 'variant';
    // "J Smith" alongside "John Smith" — one side kept only the initial.
    if (canonFirstA.startsWith(canonFirstB) || canonFirstB.startsWith(canonFirstA)) return 'variant';
    return null;
  }

  // Same first name, surname off by a letter: "Sanchez" / "Sanchz", or the
  // doubled consonant everyone drops — "Webb" typed "Web".
  if (canonFirstA === canonFirstB && lastA.length >= 3 && editDistance(lastA, lastB, 1) <= 1) {
    return 'variant';
  }
  return null;
}

function cleaned(value: string | null | undefined): string {
  return (value || '').trim();
}

/**
 * Compare two contacts. Returns null when there is no reason to think they
 * are the same person.
 *
 * A shared email or phone is the strongest thing we have — those are the
 * fields a duplicate import copies verbatim. A shared name is strong on a
 * roster this size, but weaker when the two records carry contact details
 * that flatly disagree, which is the "two different Chris Lees" case.
 */
export function compareContacts(a: DuplicateCandidate, b: DuplicateCandidate): DuplicateMatch | null {
  const emailA = normalizeEmail(a.email);
  const emailB = normalizeEmail(b.email);
  const phoneA = normalizePhone(a.phone);
  const phoneB = normalizePhone(b.phone);

  const sameEmail = Boolean(emailA) && emailA === emailB;
  const samePhone = Boolean(phoneA) && phoneA === phoneB;
  const name = compareNames(a.name, b.name);

  // Both sides have details, and none of them agree — that argues against a
  // match rather than for one.
  const conflictingEmail = Boolean(emailA) && Boolean(emailB) && emailA !== emailB;
  const conflictingPhone = Boolean(phoneA) && Boolean(phoneB) && phoneA !== phoneB;
  const contradicted = conflictingEmail && conflictingPhone;

  const reasons: string[] = [];
  let strength: MatchStrength | null = null;

  if (sameEmail) {
    reasons.push(`Same email — ${emailA}`);
    strength = 'high';
  }
  if (samePhone) {
    reasons.push(`Same phone — ${cleaned(a.phone) || phoneA}`);
    strength = 'high';
  }

  if (name === 'exact') {
    reasons.push('Same name');
    if (!strength) strength = contradicted ? 'medium' : 'high';
  } else if (name === 'nickname') {
    reasons.push('Same name, different short form');
    if (!strength) strength = contradicted ? 'low' : 'medium';
  } else if (name === 'variant') {
    reasons.push('Nearly identical name');
    // A near-miss name where every other field disagrees is two people.
    if (!strength) {
      if (contradicted) return null;
      strength = 'low';
    }
  }

  if (!strength) return null;

  // Supporting detail — never enough on its own, but it lifts a weak name
  // match and it tells the user why the pair is worth a look.
  const companyA = cleaned(a.company_name).toLowerCase();
  const companyB = cleaned(b.company_name).toLowerCase();
  if (companyA && companyA === companyB) {
    reasons.push(`Both at ${cleaned(a.company_name)}`);
    if (strength === 'low') strength = 'medium';
  }

  const roleA = cleaned(a.primary_role).toLowerCase();
  const roleB = cleaned(b.primary_role).toLowerCase();
  if (roleA && roleA === roleB) {
    reasons.push(`Both listed as ${cleaned(a.primary_role)}`);
  }

  return { strength, reasons };
}

/** Stable key for a pair of contacts, order-independent. */
export function pairKey(idA: string, idB: string): string {
  return [idA, idB].sort().join('::');
}

const STRENGTH_ORDER: Record<MatchStrength, number> = { low: 0, medium: 1, high: 2 };

/**
 * Candidate pairs, without comparing all n² of them.
 *
 * Two contacts only get compared when they already share something cheap to
 * index: a mailbox, a phone, a folded name, a first name, or a surname. On a
 * two thousand line roster that is the difference between a frozen tab and
 * an invisible pass.
 */
function candidatePairs(contacts: DuplicateCandidate[]): Array<[number, number]> {
  const blocks = new Map<string, number[]>();
  const add = (key: string, idx: number) => {
    if (!key) return;
    const bucket = blocks.get(key);
    if (bucket) bucket.push(idx);
    else blocks.set(key, [idx]);
  };

  contacts.forEach((contact, idx) => {
    add(`e:${normalizeEmail(contact.email)}`, idx);
    add(`p:${normalizePhone(contact.phone)}`, idx);
    const tokens = nameTokens(contact.name);
    add(`n:${nameKey(contact.name)}`, idx);
    if (tokens.length > 0) {
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      add(`l:${NICKNAMES[last] || last}`, idx);
      add(`f:${NICKNAMES[first] || first}`, idx);
    }
  });

  const seen = new Set<string>();
  const pairs: Array<[number, number]> = [];
  for (const [key, bucket] of blocks) {
    if (bucket.length < 2) continue;
    // A block of hundreds is a common first name, not a pile of duplicates;
    // comparing it exhaustively costs more than it finds.
    if (bucket.length > 60 && (key.startsWith('f:') || key.startsWith('l:'))) continue;
    for (let i = 0; i < bucket.length; i++) {
      for (let j = i + 1; j < bucket.length; j++) {
        const a = Math.min(bucket[i], bucket[j]);
        const b = Math.max(bucket[i], bucket[j]);
        const id = `${a}:${b}`;
        if (seen.has(id)) continue;
        seen.add(id);
        pairs.push([a, b]);
      }
    }
  }
  return pairs;
}

/**
 * Every cluster of contacts that look like the same person.
 *
 * Pairs the user has already marked "not a duplicate" (by `pairKey`) are
 * dropped before grouping, so dismissing one pair can't drag an unrelated
 * third record into the cluster.
 */
export function findDuplicateGroups(
  contacts: DuplicateCandidate[],
  dismissed: Iterable<string> = [],
): DuplicateGroup[] {
  const skip = dismissed instanceof Set ? dismissed : new Set(dismissed);
  const matches = new Map<string, DuplicateMatch>();

  // Union-find over the confirmed pairs.
  const parent = contacts.map((_, i) => i);
  const find = (i: number): number => {
    while (parent[i] !== i) {
      parent[i] = parent[parent[i]];
      i = parent[i];
    }
    return i;
  };
  const union = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootB] = rootA;
  };

  for (const [i, j] of candidatePairs(contacts)) {
    const a = contacts[i];
    const b = contacts[j];
    if (a.id === b.id) continue;
    if (skip.has(pairKey(a.id, b.id))) continue;
    const match = compareContacts(a, b);
    if (!match) continue;
    matches.set(`${i}:${j}`, match);
    union(i, j);
  }

  const byRoot = new Map<number, number[]>();
  contacts.forEach((_, idx) => {
    const root = find(idx);
    const bucket = byRoot.get(root);
    if (bucket) bucket.push(idx);
    else byRoot.set(root, [idx]);
  });

  const groups: DuplicateGroup[] = [];
  for (const members of byRoot.values()) {
    if (members.length < 2) continue;
    const reasons: string[] = [];
    const seenReasons = new Set<string>();
    let strength: MatchStrength = 'low';
    for (let i = 0; i < members.length; i++) {
      for (let j = i + 1; j < members.length; j++) {
        const match = matches.get(`${Math.min(members[i], members[j])}:${Math.max(members[i], members[j])}`);
        if (!match) continue;
        if (STRENGTH_ORDER[match.strength] > STRENGTH_ORDER[strength]) strength = match.strength;
        for (const reason of match.reasons) {
          if (seenReasons.has(reason)) continue;
          seenReasons.add(reason);
          reasons.push(reason);
        }
      }
    }
    const group = members.map(idx => contacts[idx]);
    groups.push({
      key: group.map(c => c.id).sort().join('::'),
      contacts: group,
      strength,
      reasons,
    });
  }

  // Strongest first, then biggest — the ones worth acting on lead.
  groups.sort((a, b) => {
    const byStrength = STRENGTH_ORDER[b.strength] - STRENGTH_ORDER[a.strength];
    if (byStrength !== 0) return byStrength;
    const bySize = b.contacts.length - a.contacts.length;
    if (bySize !== 0) return bySize;
    return a.contacts[0].name.localeCompare(b.contacts[0].name);
  });
  return groups;
}

/**
 * Contacts already in the rolodex that look like the one being typed or
 * imported — the same matching, aimed at one record instead of the whole
 * roster, so the warning can appear before the duplicate is created.
 */
export function findMatchesFor(
  candidate: DuplicateCandidate,
  contacts: DuplicateCandidate[],
  limit = 3,
): Array<{ contact: DuplicateCandidate; match: DuplicateMatch }> {
  const out: Array<{ contact: DuplicateCandidate; match: DuplicateMatch }> = [];
  for (const other of contacts) {
    if (!other.id || other.id === candidate.id) continue;
    const match = compareContacts(candidate, other);
    if (match) out.push({ contact: other, match });
  }
  out.sort((a, b) => STRENGTH_ORDER[b.match.strength] - STRENGTH_ORDER[a.match.strength]);
  return out.slice(0, limit);
}

/* ───────────────────────────── merging ───────────────────────────── */

export interface MergePlan {
  /** The record that survives, with the merged values applied. */
  keepId: string;
  /** Fields to write onto the surviving record. Empty when nothing is gained. */
  patch: Record<string, unknown>;
  /** Records to delete once their job references have been reassigned. */
  removeIds: string[];
  /** What the merge actually rescued, for the confirmation copy. */
  gained: string[];
}

const MERGE_FIELDS: Array<keyof DuplicateCandidate> = [
  'email', 'phone', 'company_name', 'primary_role',
  'location_city', 'location_state', 'location_country',
];

const FIELD_LABELS: Partial<Record<keyof DuplicateCandidate, string>> = {
  email: 'email', phone: 'phone', company_name: 'company', primary_role: 'primary role',
  location_city: 'city', location_state: 'state', location_country: 'country',
};

function splitTags(tags: string | null | undefined): string[] {
  return (tags || '').split(',').map(t => t.trim()).filter(Boolean);
}

/**
 * Work out what merging a group into one of its records would do.
 *
 * The surviving record never loses a value it already has — the others only
 * fill its blanks. Everything list-shaped (other roles, tags) is unioned, the
 * notes are stacked rather than overwritten, and a star anywhere survives.
 * That way a merge is additive: the worst case is a contact with a phone
 * number it didn't have before, not a lost one.
 */
export function planMerge(group: DuplicateCandidate[], keepId: string): MergePlan {
  const keep = group.find(c => c.id === keepId);
  if (!keep) throw new Error('planMerge: the record to keep is not in the group');
  const others = group.filter(c => c.id !== keepId);

  const patch: Record<string, unknown> = {};
  const gained: string[] = [];

  for (const field of MERGE_FIELDS) {
    if (cleaned(keep[field] as string | null | undefined)) continue;
    const donor = others.find(o => cleaned(o[field] as string | null | undefined));
    if (!donor) continue;
    patch[field] = cleaned(donor[field] as string | null | undefined);
    gained.push(FIELD_LABELS[field] || String(field));
  }

  // Every hat anyone in the group wears, minus the one that stays primary.
  const primary = (patch.primary_role as string) ?? keep.primary_role ?? '';
  const roles: string[] = [];
  const seenRoles = new Set<string>();
  const pushRole = (role: string | null | undefined) => {
    const trimmed = cleaned(role);
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (key === cleaned(primary).toLowerCase() || seenRoles.has(key)) return;
    seenRoles.add(key);
    roles.push(trimmed);
  };
  for (const role of keep.secondary_roles || []) pushRole(role);
  for (const other of others) {
    pushRole(other.primary_role);
    for (const role of other.secondary_roles || []) pushRole(role);
  }
  const keptRoles = (keep.secondary_roles || []).filter(Boolean);
  if (roles.length !== keptRoles.length || roles.some((r, i) => r !== keptRoles[i])) {
    patch.secondary_roles = roles;
    if (roles.length > keptRoles.length) gained.push('other roles');
  }

  const tags: string[] = [];
  const seenTags = new Set<string>();
  for (const contact of [keep, ...others]) {
    for (const tag of splitTags(contact.tags)) {
      const key = tag.toLowerCase();
      if (seenTags.has(key)) continue;
      seenTags.add(key);
      tags.push(tag);
    }
  }
  const keptTags = splitTags(keep.tags);
  if (tags.length > keptTags.length) {
    patch.tags = tags.join(', ');
    gained.push('tags');
  }

  const notes: string[] = [];
  for (const contact of [keep, ...others]) {
    const note = cleaned(contact.notes_general);
    if (note && !notes.includes(note)) notes.push(note);
  }
  if (notes.length > (cleaned(keep.notes_general) ? 1 : 0)) {
    patch.notes_general = notes.join('\n\n');
    gained.push('notes');
  }

  if (!keep.is_favorite && others.some(o => o.is_favorite)) {
    patch.is_favorite = true;
    gained.push('favorite');
  }

  return { keepId, patch, removeIds: others.map(o => o.id), gained };
}
