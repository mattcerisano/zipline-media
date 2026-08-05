import { formatLocalDate } from '@/lib/date';

/**
 * Google Calendar event descriptions for Studio OS.
 *
 * The description is what a crew member actually reads when they tap the event
 * on their phone the morning of a shoot, so it's written for that moment: the
 * things you need on the way to set, in the order you need them.
 *
 * Plain text, not HTML. Google renders HTML in its own web UI, but the same
 * event reaches Apple Calendar, Outlook, and every ICS subscriber, and those
 * show the tags raw. Sectioned plain text reads correctly everywhere, and
 * every client auto-links a bare URL.
 *
 * Empty sections are omitted rather than printed as "N/A" — a call sheet full
 * of "N/A" is worse than a short one.
 */

const FOOTER = 'Zipline Studio OS';

/** Google caps descriptions at 8 KB; long crew lists are the only realistic
 *  way to approach it, so they're bounded rather than the whole string cut. */
const MAX_CREW = 25;

export interface JobLike {
  title?: string | null;
  client_name?: string | null;
  production_company?: string | null;
  shoot_date?: string | null;
  end_date?: string | null;
  call_time?: string | null;
  job_status?: string | null;
  location_name?: string | null;
  location_address?: string | null;
  nearest_hospital_name?: string | null;
  nearest_hospital_address?: string | null;
  nearest_hospital_phone?: string | null;
  nearest_parking_name?: string | null;
  nearest_parking_address?: string | null;
  weather_summary?: string | null;
  notes_general?: string | null;
  review_link?: string | null;
  drive_folder_url?: string | null;
  discord_url?: string | null;
  gear_list_url?: string | null;
  contact_email?: string | null;
  links?: { label?: string; url?: string }[] | null;
}

export interface CrewRow {
  name?: string | null;
  position?: string | null;
  department?: string | null;
  phone?: string | null;
  call_time?: string | null;
}

/** A titled block, dropped entirely when it has no lines worth printing. */
function section(heading: string, lines: (string | null | undefined | false)[]): string | null {
  const body = lines.filter((l): l is string => typeof l === 'string' && l.trim().length > 0);
  return body.length ? `${heading}\n${body.join('\n')}` : null;
}

/** Join the parts of a line that are present, so no separator dangles. */
const join = (parts: (string | null | undefined | false)[], sep = ' · ') =>
  parts.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).join(sep);

/** "Mon 10 Aug 2026", or a range when the shoot runs more than one day. */
function dateLine(job: JobLike): string | null {
  if (!job.shoot_date) return null;
  const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' };
  const start = formatLocalDate(job.shoot_date, opts, '');
  if (!start) return null;
  if (job.end_date && job.end_date > job.shoot_date) {
    const end = formatLocalDate(job.end_date, opts, '');
    if (end) return `${start} — ${end}`;
  }
  return start;
}

/**
 * The full production write-up. Sections are ordered by what matters on the
 * way to set: when and where first, who you're shooting for after, then the
 * safety details you hope not to need, then the reading material.
 */
export function buildJobDescription(job: JobLike, crew: CrewRow[] = []): string {
  const blocks: (string | null)[] = [];

  blocks.push(section('WHEN', [
    dateLine(job),
    job.call_time ? `Call ${job.call_time}` : 'Call time TBD',
    // Worth saying out loud: a shoot still in Planning reads very differently
    // from a confirmed one, and "Confirmed" is the boring default.
    job.job_status && job.job_status !== 'Confirmed' ? `Status — ${job.job_status}` : null,
  ]));

  blocks.push(section('WHERE', [
    job.location_name,
    job.location_address,
  ]));

  blocks.push(section('CLIENT', [
    join([job.client_name, job.production_company && `via ${job.production_company}`]),
    job.contact_email,
  ]));

  if (crew.length) {
    const rows = crew.slice(0, MAX_CREW).map(c =>
      join([
        join([c.position, c.name].filter(Boolean), ' — '),
        c.call_time && `call ${c.call_time}`,
        c.phone,
      ])
    );
    if (crew.length > MAX_CREW) rows.push(`…and ${crew.length - MAX_CREW} more`);
    blocks.push(section('CREW', rows));
  }

  blocks.push(section('SAFETY', [
    join([
      job.nearest_hospital_name && `Hospital — ${job.nearest_hospital_name}`,
      job.nearest_hospital_address,
      job.nearest_hospital_phone,
    ]),
    join([
      job.nearest_parking_name && `Parking — ${job.nearest_parking_name}`,
      job.nearest_parking_address,
    ]),
    job.weather_summary && `Weather — ${job.weather_summary}`,
  ]));

  blocks.push(section('NOTES', [job.notes_general]));

  const links = [
    job.review_link && `Review — ${job.review_link}`,
    job.drive_folder_url && `Drive — ${job.drive_folder_url}`,
    job.gear_list_url && `Gear list — ${job.gear_list_url}`,
    job.discord_url && `Discord — ${job.discord_url}`,
    ...(job.links || []).map(l => (l?.url ? `${l.label || 'Link'} — ${l.url}` : null)),
  ];
  blocks.push(section('LINKS', links));

  const body = blocks.filter(Boolean).join('\n\n');
  return body ? `${body}\n\n—\n${FOOTER}` : FOOTER;
}

/**
 * Markers (Hold, Meeting, time off) carry far less, so they get a short form:
 * whatever was typed in notes, and a line naming the type so a bare "Hold" on
 * someone else's calendar isn't a mystery.
 */
export function buildMarkerDescription(event: {
  notes?: string | null;
  presetLabel?: string | null;
  event_date?: string | null;
  end_date?: string | null;
}): string {
  const blocks: (string | null)[] = [];

  if (event.event_date) {
    const opts: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
    const start = formatLocalDate(event.event_date, opts, '');
    const multi = event.end_date && event.end_date > event.event_date;
    const end = multi ? formatLocalDate(event.end_date, opts, '') : '';
    blocks.push(section('WHEN', [multi && end ? `${start} — ${end}` : start]));
  }

  blocks.push(section('TYPE', [event.presetLabel]));
  blocks.push(section('NOTES', [event.notes]));

  const body = blocks.filter(Boolean).join('\n\n');
  return body ? `${body}\n\n—\n${FOOTER}` : FOOTER;
}
