import { describe, it, expect } from 'vitest';
import { importedMarkerTiming } from './imported-event-timing';
import { STUDIO_TIME_ZONE } from './date';

/**
 * Moving an imported event is the one place the app writes back onto a real
 * Google event, so the failure modes are other people's calendars: a 2 PM
 * meeting flattened into an all-day block, an hour lost to DST, or an end that
 * lands before its start and takes the whole edit down with it.
 */

const allDay = { start: { date: '2026-08-10' }, end: { date: '2026-08-11' } };
const timed = {
  start: { dateTime: '2026-08-10T14:00:00-04:00', timeZone: 'America/New_York' },
  end: { dateTime: '2026-08-10T15:30:00-04:00', timeZone: 'America/New_York' },
};

describe('importedMarkerTiming', () => {
  it('moves an all-day event as an all-day event, ending the day after', () => {
    expect(importedMarkerTiming(allDay, { event_date: '2026-09-01' })).toEqual({
      start: { date: '2026-09-01' },
      end: { date: '2026-09-02' },
    });
  });

  it('spans an all-day event through its last day', () => {
    expect(importedMarkerTiming(allDay, { event_date: '2026-09-01', end_date: '2026-09-03' })).toEqual({
      start: { date: '2026-09-01' },
      end: { date: '2026-09-04' },
    });
  });

  it('keeps the hours a timed event was booked at and moves only the day', () => {
    expect(importedMarkerTiming(timed, { event_date: '2026-09-01' })).toEqual({
      start: { dateTime: '2026-09-01T14:00:00', timeZone: 'America/New_York' },
      end: { dateTime: '2026-09-01T15:30:00', timeZone: 'America/New_York' },
    });
  });

  it('sends a zone rather than the original offset, so a DST crossing keeps the time', () => {
    // 10 August is EDT, 1 December is EST. Baking in -04:00 would move the
    // meeting an hour; naming the zone lets Google resolve it.
    const out = importedMarkerTiming(timed, { event_date: '2026-12-01' });
    expect(out?.start.dateTime).toBe('2026-12-01T14:00:00');
    expect(out?.start.dateTime).not.toContain('-04:00');
    expect(out?.start.timeZone).toBe('America/New_York');
  });

  it('ends a timed span on its last day, at the hour it always ended', () => {
    expect(importedMarkerTiming(timed, { event_date: '2026-09-01', end_date: '2026-09-02' })?.end).toEqual({
      dateTime: '2026-09-02T15:30:00',
      timeZone: 'America/New_York',
    });
  });

  it('rolls an overnight event onto the next day instead of ending before it starts', () => {
    const overnight = {
      start: { dateTime: '2026-08-10T22:00:00-04:00', timeZone: 'America/New_York' },
      end: { dateTime: '2026-08-11T01:00:00-04:00', timeZone: 'America/New_York' },
    };
    expect(importedMarkerTiming(overnight, { event_date: '2026-09-01' })).toEqual({
      start: { dateTime: '2026-09-01T22:00:00', timeZone: 'America/New_York' },
      end: { dateTime: '2026-09-02T01:00:00', timeZone: 'America/New_York' },
    });
  });

  it('treats an end at or before the start date as a single day', () => {
    const out = importedMarkerTiming(allDay, { event_date: '2026-09-01', end_date: '2026-08-30' });
    expect(out).toEqual({ start: { date: '2026-09-01' }, end: { date: '2026-09-02' } });
  });

  it("falls back to the studio's zone when Google names none", () => {
    const zoneless = {
      start: { dateTime: '2026-08-10T09:00:00Z' },
      end: { dateTime: '2026-08-10T10:00:00Z' },
    };
    expect(importedMarkerTiming(zoneless, { event_date: '2026-09-01' })?.start.timeZone).toBe(STUDIO_TIME_ZONE);
  });

  it('refuses rather than guessing when the time cannot be read', () => {
    expect(importedMarkerTiming({ start: { dateTime: 'sometime tuesday' }, end: {} }, { event_date: '2026-09-01' }))
      .toBeNull();
    expect(importedMarkerTiming({}, { event_date: '2026-09-01' })).toBeNull();
  });
});
