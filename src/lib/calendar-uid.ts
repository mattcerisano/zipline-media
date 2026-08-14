/**
 * Stable iCalendar UIDs for the subscribable feed.
 *
 * A UID is the only thing a calendar client uses to recognise an event it
 * already holds: same UID means "this is that shoot, updated", a new UID means
 * "this is a different shoot". The `ics` package mints a fresh nanoid for any
 * event that doesn't supply one, so every poll of /api/calendar described the
 * same productions under brand-new identities — editing a job produced a
 * second event on the subscriber's calendar instead of changing the one that
 * was already there.
 *
 * Deriving the UID from the row id keeps exactly one calendar event per job,
 * for the life of the job, no matter how many times the feed is rendered.
 */

/** Domain half of the UID. RFC 5545 wants UIDs globally unique, not just
 *  unique within the feed, so the studio's own domain qualifies the row id. */
const UID_DOMAIN = 'zipline.media';

/** The feed's UID for a job. Same job, same UID, on every request. */
export function jobEventUid(jobId: string): string {
  return `job-${jobId}@${UID_DOMAIN}`;
}
