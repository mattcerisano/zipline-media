/**
 * One place that turns Studio OS's stored dates and wall-clock times into the
 * `start`/`end` a Google Calendar event wants.
 *
 * Productions (call time → wrap time) and calendar markers (start time → end
 * time) had separate answers to the same question, and only productions ever
 * had one: a marker was always written as an all-day event, so a 2:00 PM
 * client meeting booked here landed on Google as a block covering the whole
 * day. Both now go through this.
 *
 * Times are wall-clock strings with no zone ("2:00 PM") — they mean that hour
 * where the shoot is. They are sent as a naive `dateTime` plus an explicit
 * `timeZone` so Google resolves them there; building a `Date` instead resolves
 * against the server clock, which is UTC on Vercel, and is what once put an
 * 8:00 AM call on the calendar at 4:00 AM Eastern.
 */

import { STUDIO_TIME_ZONE, parseCallTime, addDays } from './date';

export interface TimingInput {
  /** First day, "YYYY-MM-DD". */
  startDate: string;
  /** Last day of a span, inclusive. At or before the start means a single day. */
  endDate?: string | null;
  /** Wall-clock start ("8:00 AM"). Absent means an all-day entry. */
  startTime?: string | null;
  /** Wall-clock end. Absent falls back to `defaultDurationHours`. */
  endTime?: string | null;
  /** How long the entry runs when no end time is recorded. */
  defaultDurationHours: number;
  /** Overridable for tests and non-default deployments. */
  timeZone?: string;
}

export interface GoogleTiming {
  start: Record<string, string>;
  end: Record<string, string>;
  /** True when this is an all-day entry, i.e. no usable start time. */
  allDay: boolean;
}

const hhmmss = (hour: number, minute: number) =>
  `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00`;

export function buildGoogleTiming(input: TimingInput): GoogleTiming {
  const startDate = input.startDate;
  // An end at or before the start is a stale value, not a span.
  const lastDate = input.endDate && input.endDate > startDate ? input.endDate : startDate;
  const timeZone = input.timeZone || STUDIO_TIME_ZONE;
  const start = parseCallTime(input.startTime);

  if (!start) {
    // Google's all-day end date is exclusive, so a single day ends tomorrow —
    // an end equal to the start is rejected outright.
    return {
      start: { date: startDate },
      end: { date: addDays(lastDate, 1) },
      allDay: true,
    };
  }

  const end = parseCallTime(input.endTime);
  let endDate: string;
  let endHhmm: string;

  if (end) {
    // An end at or before the start is an overnight — a night shoot, or a
    // 10 PM–2 AM hold — not bad data. Rolling it onto the next day is what
    // keeps it from ending before it begins.
    const crossesMidnight = end.hour * 60 + end.minute <= start.hour * 60 + start.minute;
    endDate = crossesMidnight ? addDays(lastDate, 1) : lastDate;
    endHhmm = hhmmss(end.hour, end.minute);
  } else {
    const totalHours = start.hour + input.defaultDurationHours;
    endDate = totalHours >= 24 ? addDays(lastDate, 1) : lastDate;
    endHhmm = hhmmss(totalHours % 24, start.minute);
  }

  return {
    start: { dateTime: `${startDate}T${hhmmss(start.hour, start.minute)}`, timeZone },
    end: { dateTime: `${endDate}T${endHhmm}`, timeZone },
    allDay: false,
  };
}

/** How long a marker runs when only a start time was given. */
export const DEFAULT_MARKER_HOURS = 1;
/** How long a shoot runs when nobody has recorded a wrap time. */
export const DEFAULT_SHOOT_HOURS = 8;
