import { describe, expect, it } from 'vitest';
import { countOpens, rankTabsByUse } from './tab-ranking';

const tabs = ['dashboard', 'calendar', 'slate', 'edits', 'vault'].map(id => ({ id }));

describe('rankTabsByUse', () => {
  it('puts the most-opened tabs first', () => {
    const ranked = rankTabsByUse(tabs, { slate: 40, edits: 12, dashboard: 30 });
    expect(ranked.map(t => t.id)).toEqual(['slate', 'dashboard', 'edits', 'calendar', 'vault']);
  });

  it('keeps the saved order for ties and unopened tabs', () => {
    expect(rankTabsByUse(tabs, {}).map(t => t.id)).toEqual(tabs.map(t => t.id));
    expect(rankTabsByUse(tabs, { vault: 3, calendar: 3 }).map(t => t.id)).toEqual(['calendar', 'vault', 'dashboard', 'slate', 'edits']);
  });

  it('ignores counts for tabs not in the list', () => {
    expect(rankTabsByUse(tabs, { review: 99 }).map(t => t.id)).toEqual(tabs.map(t => t.id));
  });
});

describe('countOpens', () => {
  it('counts rows per surface', () => {
    expect(countOpens([{ surface: 'slate' }, { surface: 'slate' }, { surface: 'vault' }, { surface: null }])).toEqual({ slate: 2, vault: 1 });
  });
});
