/**
 * Call-time math for the reminder cron. Call times are free-typed wall-clock
 * text ("07:30 AM", "8am", "19:00") on jobs and job_roles, and shoot dates are
 * date-only strings — so turning "the 7:30 call on the 22nd" into a real
 * instant needs the org's IANA timezone (organizations.timezone).
 */

/** Parse loose wall-clock text to hours+minutes; null for "TBD" and friends. */
export function parseCallTime(text: string | null | undefined): { hours: number; minutes: number } | null {
  if (!text) return null;
  const m = /(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)?/i.exec(text.trim());
  if (!m) return null;
  let hours = Number(m[1]);
  const minutes = m[2] ? Number(m[2]) : 0;
  const meridiem = m[3]?.toLowerCase();
  if (meridiem?.startsWith('p') && hours < 12) hours += 12;
  if (meridiem?.startsWith('a') && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) return null;
  return { hours, minutes };
}

/** Milliseconds the given zone is ahead of UTC at the given instant. */
function tzOffsetMs(at: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false,
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value || 0);
  // hourCycle quirk: midnight can format as "24".
  const hour = get('hour') === 24 ? 0 : get('hour');
  const asIfUtc = Date.UTC(get('year'), get('month') - 1, get('day'), hour, get('minute'), get('second'));
  return asIfUtc - at.getTime();
}

/**
 * The UTC instant of a wall-clock time on a "YYYY-MM-DD" day in a zone.
 * Two passes so a DST switch on the shoot day itself resolves correctly.
 */
export function wallTimeToUtc(dateStr: string, hours: number, minutes: number, timeZone: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateStr);
  if (!m) return null;
  const naiveUtc = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]), hours, minutes);
  try {
    const guess = naiveUtc - tzOffsetMs(new Date(naiveUtc), timeZone);
    return new Date(naiveUtc - tzOffsetMs(new Date(guess), timeZone));
  } catch {
    return null; // bad IANA zone name
  }
}
