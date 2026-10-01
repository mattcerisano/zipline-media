/**
 * Draft links on an Edit Tracker card — the "here's v3" post an editor used
 * to drop in Discord. A draft is a plain link with a title and a version
 * number: no embed (the studio's Vimeo uploads are private, so a player can't
 * load them anyway), just something a producer can click.
 *
 * Drafts live in `jobs.links` alongside the Creative tab's reference links,
 * told apart by `category: 'Draft'`. That column is already on the editor's
 * write whitelist (migration 20260822000000), so an editor can post a cut to a
 * card they're assigned without a schema change.
 */
import type { JobLink } from '@/components/gearbuilder/types';

export const DRAFT_CATEGORY = 'Draft' as const;

export interface DraftGroup {
  title: string;
  /** Newest first. */
  versions: JobLink[];
}

export const isDraft = (link: JobLink | null | undefined): boolean =>
  !!link && link.category === DRAFT_CATEGORY && !!link.url;

/**
 * Pull a usable URL out of whatever was pasted. Editors paste straight from
 * Vimeo's share sheet or from a Discord message ("v2 is up: https://…"), so
 * this takes the first http(s) URL in the text, or — when the paste is just
 * an address — a bare domain like `vimeo.com/123` with https:// added.
 * Anything else returns null.
 */
export function extractDraftUrl(raw: string): string | null {
  const text = (raw || '').trim();
  if (!text) return null;

  const withScheme = text.match(/https?:\/\/[^\s<>"'`]+/i);
  if (withScheme) return stripTrailingPunctuation(withScheme[0]);

  // Without a scheme, only when the paste is nothing but the address — inside
  // a sentence, "final.mov is up" would otherwise become https://final.mov.
  const bare = text.match(/^((?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>"'`]*)?)$/i);
  if (bare) return `https://${stripTrailingPunctuation(bare[1])}`;

  return null;
}

// "check it out (https://vimeo.com/1)." — the ) and . belong to the sentence.
function stripTrailingPunctuation(url: string): string {
  return url.replace(/[)\].,;:!?]+$/, '');
}

const titleKey = (title?: string | null) => (title || '').trim().toLowerCase();

/** The version number the next draft with this title should carry. */
export function nextDraftVersion(links: JobLink[] | null | undefined, title: string): number {
  const key = titleKey(title);
  let max = 0;
  for (const link of links || []) {
    if (!link || !isDraft(link) || titleKey(link.label) !== key) continue;
    max = Math.max(max, link.version || 0);
  }
  return max + 1;
}

/**
 * Drafts grouped by title, each group newest version first, groups ordered by
 * their most recent post so the cut someone just uploaded is on top.
 */
export function groupDrafts(links: JobLink[] | null | undefined): DraftGroup[] {
  const groups = new Map<string, DraftGroup>();
  for (const link of links || []) {
    if (!link || !isDraft(link)) continue;
    const key = titleKey(link.label);
    const group = groups.get(key) || { title: (link.label || '').trim() || 'Draft', versions: [] };
    group.versions.push(link);
    groups.set(key, group);
  }

  const stamp = (l: JobLink) => (l.added_at ? Date.parse(l.added_at) || 0 : 0);
  const list = [...groups.values()];
  for (const g of list) {
    g.versions.sort((a, b) => (b.version || 0) - (a.version || 0) || stamp(b) - stamp(a));
  }
  return list.sort((a, b) => {
    const newest = (g: DraftGroup) => Math.max(...g.versions.map(stamp));
    return newest(b) - newest(a) || a.title.localeCompare(b.title);
  });
}

/**
 * For places that list a card's links in passing (the Slate card, the Google
 * Calendar event): every non-draft link, plus only the newest version of each
 * draft. The version history belongs on the Edit Tracker card, not in a
 * calendar description that grows by a line per cut. Order is preserved.
 */
export function latestDraftLinks<L extends Pick<JobLink, 'category' | 'version'> & { label?: string; url?: string }>(
  links: L[] | null | undefined,
): L[] {
  const newest = new Map<string, L>();
  for (const link of links || []) {
    if (!link || link.category !== DRAFT_CATEGORY || !link.url) continue;
    const key = titleKey(link.label);
    const held = newest.get(key);
    if (!held || (link.version || 0) >= (held.version || 0)) newest.set(key, link);
  }
  const keep = new Set(newest.values());
  return (links || []).filter(l => !!l && (l.category !== DRAFT_CATEGORY || keep.has(l)));
}

/**
 * The `links` and `review_link` a card should have after posting `draft`.
 * Posting makes the new cut the review link; a review link that was set by
 * hand before drafts existed (a Frame.io review page, say) is not a draft, so
 * it is kept as an ordinary link rather than silently overwritten.
 */
export function withPostedDraft(
  links: JobLink[] | null | undefined,
  reviewLink: string | null | undefined,
  draft: JobLink,
): { links: JobLink[]; review_link: string } {
  const current = links || [];
  const old = (reviewLink || '').trim();
  const oldIsKnown = !old || current.some(l => l && l.url === old);
  return {
    links: [
      ...current,
      ...(oldIsKnown ? [] : [{ label: 'Review link', url: old, category: 'Review' as const }]),
      draft,
    ],
    review_link: draft.url,
  };
}

/** Build the link a new draft post appends to `jobs.links`. */
export function makeDraft(
  links: JobLink[] | null | undefined,
  title: string,
  url: string,
  addedBy?: string | null,
  now: Date = new Date(),
): JobLink {
  const label = title.trim() || 'Draft';
  return {
    label,
    url,
    category: DRAFT_CATEGORY,
    version: nextDraftVersion(links, label),
    added_at: now.toISOString(),
    ...(addedBy ? { added_by: addedBy } : {}),
  };
}
