import { describe, it, expect } from 'vitest';
import {
  parseCallTime,
  formatCallTime,
  addDays,
  zonedWallClockToDate,
  wallClockFromGoogleDateTime,
  todayLocalISO,
  parseLocalDate,
  timeOptions,
  minutesSinceMidnight,
} from './date';

/**
 * Timezone maths, which is where this app has actually been bitten.
 *
 * An 8:00 AM call once reached Google Calendar as 4:00 AM because a wall-clock
 * string was resolved against the server clock — UTC on Vercel. The same class
 * of bug put tomorrow's date in a "today" field every evening. Neither showed
 * up in a build; both showed up on a call sheet.
 */

describe('parseCallTime', () => {
  it('reads 12-hour times with and without minutes', () => {
    expect(parseCallTime('8:00 AM')).toEqual({ hour: 8, minute: 0 });
    expect(parseCallTime('7 AM')).toEqual({ hour: 7, minute: 0 });
    expect(parseCallTime('5:30 PM')).toEqual({ hour: 17, minute: 30 });
  });

  it('handles the midnight and noon boundaries, where 12 is not 12', () => {
    expect(parseCallTime('12:00 AM')).toEqual({ hour: 0, minute: 0 });
    expect(parseCallTime('12:00 PM')).toEqual({ hour: 12, minute: 0 });
  });

  it('reads 24-hour times', () => {
    expect(parseCallTime('08:00')).toEqual({ hour: 8, minute: 0 });
    expect(parseCallTime('17:45')).toEqual({ hour: 17, minute: 45 });
  });

  it('returns null for anything unparseable, so callers fall back to all-day', () => {
    expect(parseCallTime('')).toBeNull();
    expect(parseCallTime(null)).toBeNull();
    expect(parseCallTime('TBD')).toBeNull();
  });

  it('round-trips through formatCallTime', () => {
    for (const t of ['8:00 AM', '12:00 AM', '12:00 PM', '5:30 PM']) {
      expect(formatCallTime(parseCallTime(t)!)).toBe(t);
    }
  });
});

describe('addDays', () => {
  it('rolls over month ends rather than producing a day 32', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(addDays('2026-08-31', 1)).toBe('2026-09-01');
  });

  it('rolls over year ends', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('gets February right in a leap year and a common year', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01');
  });

  it('does not skip a day across a DST boundary', () => {
    // US DST starts 2026-03-08 and ends 2026-11-01. Date arithmetic done in
    // local time loses or repeats an hour here and can land on the wrong day.
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09');
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01');
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('steps backwards too', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('zonedWallClockToDate', () => {
  const iso = (d: Date | null) => d?.toISOString();

  it('resolves a wall clock in the given zone, not the server zone', () => {
    // 8:00 AM Eastern in August is EDT (UTC-4) → 12:00 UTC.
    // The bug this guards was 08:00Z, i.e. 4:00 AM Eastern.
    expect(iso(zonedWallClockToDate('2026-08-10', { hour: 8, minute: 0 }, 'America/New_York')))
      .toBe('2026-08-10T12:00:00.000Z');
  });

  it('follows the offset across both DST transitions', () => {
    // January is EST (UTC-5) → 13:00 UTC for the same wall clock.
    expect(iso(zonedWallClockToDate('2026-01-10', { hour: 8, minute: 0 }, 'America/New_York')))
      .toBe('2026-01-10T13:00:00.000Z');
    // The day after DST starts is EDT again.
    expect(iso(zonedWallClockToDate('2026-03-09', { hour: 8, minute: 0 }, 'America/New_York')))
      .toBe('2026-03-09T12:00:00.000Z');
    // The day after it ends is back to EST.
    expect(iso(zonedWallClockToDate('2026-11-02', { hour: 8, minute: 0 }, 'America/New_York')))
      .toBe('2026-11-02T13:00:00.000Z');
  });

  it('handles a zone with no DST', () => {
    expect(iso(zonedWallClockToDate('2026-08-10', { hour: 8, minute: 0 }, 'UTC')))
      .toBe('2026-08-10T08:00:00.000Z');
  });

  it('returns null on a malformed date rather than an Invalid Date', () => {
    expect(zonedWallClockToDate('', { hour: 8, minute: 0 }, 'America/New_York')).toBeNull();
    expect(zonedWallClockToDate('not-a-date', { hour: 8, minute: 0 }, 'America/New_York')).toBeNull();
  });
});

describe('wallClockFromGoogleDateTime', () => {
  it('reads the wall clock Google sent, ignoring the offset', () => {
    // Parsing this with new Date() and reading getHours() is what turned an
    // 8:00 AM Eastern call into 12:00 PM on the way back in.
    expect(wallClockFromGoogleDateTime('2026-08-10T08:00:00-04:00'))
      .toEqual({ date: '2026-08-10', hour: 8, minute: 0 });
    expect(wallClockFromGoogleDateTime('2026-01-10T17:30:00-05:00'))
      .toEqual({ date: '2026-01-10', hour: 17, minute: 30 });
  });

  it('handles a Z-suffixed time', () => {
    expect(wallClockFromGoogleDateTime('2026-08-10T08:00:00Z'))
      .toEqual({ date: '2026-08-10', hour: 8, minute: 0 });
  });

  it('returns null for an all-day event, which carries a date and no time', () => {
    expect(wallClockFromGoogleDateTime('2026-08-10')).toBeNull();
    expect(wallClockFromGoogleDateTime(null)).toBeNull();
  });
});

describe('todayLocalISO', () => {
  it('uses local parts, not the UTC day', () => {
    // 9pm on 6 Aug in a UTC-5 zone is already 7 Aug in UTC. toISOString() would
    // return the 7th and pre-fill tomorrow into a field labelled "today".
    const evening = new Date(2026, 7, 6, 21, 30, 0);
    expect(todayLocalISO(evening)).toBe('2026-08-06');
  });

  it('zero-pads so the string sorts and compares correctly', () => {
    expect(todayLocalISO(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});

describe('parseLocalDate', () => {
  it('reads a stored date as local midnight, not UTC midnight', () => {
    const d = parseLocalDate('2026-08-10');
    expect(d?.getFullYear()).toBe(2026);
    expect(d?.getMonth()).toBe(7);
    expect(d?.getDate()).toBe(10);
  });

  it('rejects junk', () => {
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate(null)).toBeNull();
  });
});

describe('timeOptions', () => {
  it('offers quarter hours by default, so a 1:15 call is pickable', () => {
    const labels = timeOptions().map(o => o.label);
    expect(labels).toHaveLength(96);
    expect(labels).toContain('1:15 PM');
    expect(labels).toContain('2:45 AM');
    expect(labels[0]).toBe('12:00 AM');
    expect(labels[labels.length - 1]).toBe('11:45 PM');
  });

  it('pairs each label with the 24-hour value the schedule rows store', () => {
    const opts = timeOptions();
    expect(opts[5]).toEqual({ value: '01:15', label: '1:15 AM' });
    expect(opts.find(o => o.label === '1:15 PM')?.value).toBe('13:15');
  });

  it('honours a coarser step for callers that want one', () => {
    expect(timeOptions(30)).toHaveLength(48);
    expect(timeOptions(30).some(o => o.label === '1:15 PM')).toBe(false);
  });

  it('round-trips every option back through parseCallTime', () => {
    for (const opt of timeOptions()) {
      expect(formatCallTime(parseCallTime(opt.value)!)).toBe(opt.label);
    }
  });
});

describe('minutesSinceMidnight', () => {
  it('orders a wrap against a call regardless of stored format', () => {
    expect(minutesSinceMidnight('1:15 PM')).toBe(13 * 60 + 15);
    expect(minutesSinceMidnight('13:15')).toBe(13 * 60 + 15);
    expect(minutesSinceMidnight('12:00 AM')).toBe(0);
  });

  it('returns null for a time it cannot read, so callers skip the comparison', () => {
    expect(minutesSinceMidnight('TBD')).toBeNull();
    expect(minutesSinceMidnight(null)).toBeNull();
  });
});
