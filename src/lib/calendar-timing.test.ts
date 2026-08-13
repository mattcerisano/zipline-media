import { describe, it, expect } from 'vitest';
import { buildGoogleTiming, DEFAULT_MARKER_HOURS, DEFAULT_SHOOT_HOURS } from './calendar-timing';

const TZ = 'America/New_York';

describe('buildGoogleTiming', () => {
  it('writes an all-day event when there is no start time', () => {
    const timing = buildGoogleTiming({
      startDate: '2026-08-10',
      defaultDurationHours: DEFAULT_MARKER_HOURS,
      timeZone: TZ,
    });
    expect(timing.allDay).toBe(true);
    // Google's all-day end is exclusive: a single day ends tomorrow.
    expect(timing.start).toEqual({ date: '2026-08-10' });
    expect(timing.end).toEqual({ date: '2026-08-11' });
  });

  it('spans an all-day range through its last day', () => {
    const timing = buildGoogleTiming({
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      defaultDurationHours: DEFAULT_MARKER_HOURS,
      timeZone: TZ,
    });
    expect(timing.end).toEqual({ date: '2026-08-13' });
  });

  it('sends a naive dateTime plus the zone, never a UTC instant', () => {
    const timing = buildGoogleTiming({
      startDate: '2026-08-10',
      startTime: '2:00 PM',
      endTime: '3:30 PM',
      defaultDurationHours: DEFAULT_MARKER_HOURS,
      timeZone: TZ,
    });
    expect(timing.allDay).toBe(false);
    expect(timing.start).toEqual({ dateTime: '2026-08-10T14:00:00', timeZone: TZ });
    expect(timing.end).toEqual({ dateTime: '2026-08-10T15:30:00', timeZone: TZ });
  });

  it('falls back to the default duration when no end time is set', () => {
    const marker = buildGoogleTiming({
      startDate: '2026-08-10',
      startTime: '2:00 PM',
      defaultDurationHours: DEFAULT_MARKER_HOURS,
      timeZone: TZ,
    });
    expect(marker.end).toEqual({ dateTime: '2026-08-10T15:00:00', timeZone: TZ });

    const shoot = buildGoogleTiming({
      startDate: '2026-08-10',
      startTime: '8:00 AM',
      defaultDurationHours: DEFAULT_SHOOT_HOURS,
      timeZone: TZ,
    });
    expect(shoot.end).toEqual({ dateTime: '2026-08-10T16:00:00', timeZone: TZ });
  });

  it('rolls an overnight end onto the next day rather than ending before it starts', () => {
    const timing = buildGoogleTiming({
      startDate: '2026-08-10',
      startTime: '10:00 PM',
      endTime: '2:00 AM',
      defaultDurationHours: DEFAULT_MARKER_HOURS,
      timeZone: TZ,
    });
    expect(timing.end).toEqual({ dateTime: '2026-08-11T02:00:00', timeZone: TZ });
  });

  it('rolls the default duration past midnight too', () => {
    const timing = buildGoogleTiming({
      startDate: '2026-08-10',
      startTime: '11:00 PM',
      defaultDurationHours: DEFAULT_SHOOT_HOURS,
      timeZone: TZ,
    });
    expect(timing.end).toEqual({ dateTime: '2026-08-11T07:00:00', timeZone: TZ });
  });

  it('ends a timed multi-day span on its last day', () => {
    const timing = buildGoogleTiming({
      startDate: '2026-08-10',
      endDate: '2026-08-12',
      startTime: '8:00 AM',
      endTime: '6:00 PM',
      defaultDurationHours: DEFAULT_SHOOT_HOURS,
      timeZone: TZ,
    });
    expect(timing.start).toEqual({ dateTime: '2026-08-10T08:00:00', timeZone: TZ });
    expect(timing.end).toEqual({ dateTime: '2026-08-12T18:00:00', timeZone: TZ });
  });

  it('ignores an end date at or before the start', () => {
    const timing = buildGoogleTiming({
      startDate: '2026-08-10',
      endDate: '2026-08-09',
      defaultDurationHours: DEFAULT_MARKER_HOURS,
      timeZone: TZ,
    });
    expect(timing.end).toEqual({ date: '2026-08-11' });
  });
});
