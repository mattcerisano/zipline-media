import { describe, it, expect } from 'vitest';
import { buildJobDescription, buildMarkerDescription } from './event-description';

/**
 * What a crew member reads when they open the event on their phone.
 *
 * The failure mode isn't a crash — it's a description full of "N/A", a crew
 * list long enough to hit Google's 8 KB cap, or a dangling separator where a
 * field happened to be empty. All silent, all visible only on set.
 */

describe('buildJobDescription', () => {
  it('omits sections that have nothing in them', () => {
    const out = buildJobDescription({ title: 'Scout Day', shoot_date: '2026-08-10' });
    expect(out).toContain('WHEN');
    expect(out).not.toContain('WHERE');
    expect(out).not.toContain('CLIENT');
    expect(out).not.toContain('SAFETY');
    expect(out).not.toContain('LINKS');
    expect(out).not.toContain('N/A');
  });

  it('says the call time is TBD rather than leaving it blank', () => {
    expect(buildJobDescription({ shoot_date: '2026-08-10' })).toContain('Call time TBD');
    expect(buildJobDescription({ shoot_date: '2026-08-10', call_time: '8:00 AM' })).toContain('Call 8:00 AM');
  });

  it('renders a multi-day shoot as a range, and a single day as one date', () => {
    const range = buildJobDescription({ shoot_date: '2026-08-10', end_date: '2026-08-12' });
    expect(range).toMatch(/Aug 10, 2026 — .*Aug 12, 2026/);

    // An end date at or before the start is stale data, not a span.
    const single = buildJobDescription({ shoot_date: '2026-08-10', end_date: '2026-08-10' });
    expect(single).not.toContain('—\nZipline'.slice(0, 1) + ' Aug');
    expect(single.match(/Aug 10, 2026/g)?.length).toBe(1);
  });

  it('never leaves a dangling separator when part of a line is missing', () => {
    const out = buildJobDescription({
      shoot_date: '2026-08-10',
      client_name: 'Acme Films',
      // no production_company, no contact_email
    });
    expect(out).toContain('Acme Films');
    expect(out).not.toMatch(/·\s*$/m);
    expect(out).not.toContain('· ·');
  });

  it('caps the crew list so a big call sheet cannot blow the 8 KB limit', () => {
    const crew = Array.from({ length: 40 }, (_, i) => ({ position: 'PA', name: `Person ${i + 1}` }));
    const out = buildJobDescription({ shoot_date: '2026-08-10' }, crew);
    expect(out).toContain('Person 25');
    expect(out).not.toContain('Person 26');
    expect(out).toContain('…and 15 more');
  });

  it('keeps the whole crew when it fits', () => {
    const crew = [
      { position: 'Director', name: 'Matt', call_time: '7:30 AM', phone: '555-0100' },
      { position: 'DP', name: 'Jane' },
    ];
    const out = buildJobDescription({ shoot_date: '2026-08-10' }, crew);
    expect(out).toContain('Director — Matt · call 7:30 AM · 555-0100');
    expect(out).toContain('DP — Jane');
    expect(out).not.toContain('more');
  });

  it('shows a status only when it is worth saying', () => {
    expect(buildJobDescription({ shoot_date: '2026-08-10', job_status: 'Planning' })).toContain('Status — Planning');
    // Confirmed is the boring default and would be noise on every event.
    expect(buildJobDescription({ shoot_date: '2026-08-10', job_status: 'Confirmed' })).not.toContain('Status');
  });

  it('is plain text — Apple Calendar and ICS subscribers would show tags raw', () => {
    const out = buildJobDescription({
      shoot_date: '2026-08-10',
      notes_general: 'Load in via the dock',
      review_link: 'https://frame.io/x/abc',
    });
    expect(out).not.toMatch(/<[a-z/][^>]*>/i);
    expect(out).toContain('https://frame.io/x/abc');
  });

  it('always signs off, even with nothing to say', () => {
    expect(buildJobDescription({})).toBe('Zipline Studio OS');
  });
});

describe('buildMarkerDescription', () => {
  it('names the type so a bare Hold on someone else’s calendar is not a mystery', () => {
    const out = buildMarkerDescription({ presetLabel: 'Hold', event_date: '2026-08-10' });
    expect(out).toContain('TYPE');
    expect(out).toContain('Hold');
  });

  it('shows a range only for a genuine multi-day marker', () => {
    const multi = buildMarkerDescription({ presetLabel: 'Hold', event_date: '2026-08-10', end_date: '2026-08-12' });
    expect(multi).toMatch(/Aug 10 — .*Aug 12/);

    const single = buildMarkerDescription({ presetLabel: 'Hold', event_date: '2026-08-10', end_date: '2026-08-10' });
    expect(single).not.toContain('—\nAug');
    expect(single.match(/Aug 10/g)?.length).toBe(1);
  });

  it('drops the notes section when there are none', () => {
    expect(buildMarkerDescription({ presetLabel: 'Hold', event_date: '2026-08-10' })).not.toContain('NOTES');
    expect(buildMarkerDescription({ presetLabel: 'Hold', event_date: '2026-08-10', notes: 'Holding for Acme' })).toContain('NOTES');
  });
});
