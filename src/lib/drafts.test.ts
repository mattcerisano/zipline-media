import { describe, expect, it } from 'vitest';
import { extractDraftUrl, groupDrafts, latestDraftLinks, makeDraft, nextDraftVersion, withPostedDraft } from './drafts';
import type { JobLink } from '@/components/gearbuilder/types';

describe('extractDraftUrl', () => {
  it('keeps a plain link as-is', () => {
    expect(extractDraftUrl('https://vimeo.com/1231072750/d9cef635df?share=copy')).toBe(
      'https://vimeo.com/1231072750/d9cef635df?share=copy',
    );
  });

  it('pulls the link out of a Discord-style message', () => {
    expect(extractDraftUrl('v2 is up: https://vimeo.com/123/abc — notes welcome')).toBe('https://vimeo.com/123/abc');
  });

  it('drops sentence punctuation after the link', () => {
    expect(extractDraftUrl('(see https://f.io/L3t-8n3q).')).toBe('https://f.io/L3t-8n3q');
  });

  it('adds https to a bare domain', () => {
    expect(extractDraftUrl('vimeo.com/123456')).toBe('https://vimeo.com/123456');
  });

  it('rejects text with no link in it', () => {
    expect(extractDraftUrl('final cut')).toBeNull();
    expect(extractDraftUrl('   ')).toBeNull();
    expect(extractDraftUrl('javascript:alert(1)')).toBeNull();
    expect(extractDraftUrl('final.mov is up')).toBeNull();
  });
});

describe('versions', () => {
  const links: JobLink[] = [
    { label: 'Moodboard', url: 'https://a', category: 'Creative' },
    { label: 'Hero Cut', url: 'https://v1', category: 'Draft', version: 1, added_at: '2026-09-01T00:00:00Z' },
    { label: 'hero cut ', url: 'https://v2', category: 'Draft', version: 2, added_at: '2026-09-03T00:00:00Z' },
    { label: 'Teaser', url: 'https://t1', category: 'Draft', version: 1, added_at: '2026-09-02T00:00:00Z' },
  ];

  it('counts up per title, ignoring case and non-draft links', () => {
    expect(nextDraftVersion(links, 'HERO CUT')).toBe(3);
    expect(nextDraftVersion(links, 'Teaser')).toBe(2);
    expect(nextDraftVersion(links, 'Moodboard')).toBe(1);
    expect(nextDraftVersion(undefined, 'Anything')).toBe(1);
  });

  it('groups by title, newest group and newest version first', () => {
    const groups = groupDrafts(links);
    expect(groups.map(g => g.title)).toEqual(['Hero Cut', 'Teaser']);
    expect(groups[0].versions.map(v => v.version)).toEqual([2, 1]);
  });

  it('keeps only the newest version of each draft, in place', () => {
    expect(latestDraftLinks(links).map(l => l.url)).toEqual(['https://a', 'https://v2', 'https://t1']);
    expect(latestDraftLinks(null)).toEqual([]);
  });

  it('keeps a hand-set review link instead of overwriting it', () => {
    const draft = { label: 'Cut', url: 'https://vimeo.com/9', category: 'Draft' as const, version: 1 };
    const fresh = withPostedDraft([], 'https://f.io/L3t-8n3q', draft);
    expect(fresh.review_link).toBe('https://vimeo.com/9');
    expect(fresh.links.map(l => [l.category, l.url])).toEqual([['Review', 'https://f.io/L3t-8n3q'], ['Draft', 'https://vimeo.com/9']]);
    // Already a draft, or nothing set: nothing extra kept.
    expect(withPostedDraft(links, 'https://v2', draft).links).toHaveLength(links.length + 1);
    expect(withPostedDraft(null, null, draft).links).toEqual([draft]);
  });

  it('builds the next draft with a default title', () => {
    const now = new Date('2026-09-30T12:00:00Z');
    expect(makeDraft(links, '  ', 'https://x', 'Rob', now)).toEqual({
      label: 'Draft', url: 'https://x', category: 'Draft', version: 1, added_at: now.toISOString(), added_by: 'Rob',
    });
    expect(makeDraft(links, 'Hero cut', 'https://v3', null, now).version).toBe(3);
  });
});
