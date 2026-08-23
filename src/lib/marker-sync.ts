import { createClient } from '@supabase/supabase-js';
import { getValidGoogleToken } from '@/lib/google-auth';
import { resolveStudioCalendarUserId } from '@/lib/studio-calendar';
import { deleteEventFrom } from '@/lib/calendar-google';
import { STUDIO_MARKER_TAG } from '@/lib/calendar-tags';
import { buildMarkerDescription } from '@/lib/event-description';
import { buildGoogleTiming, DEFAULT_MARKER_HOURS } from '@/lib/calendar-timing';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

const EVENTS_URL = 'https://www.googleapis.com/calendar/v3/calendars/primary/events';

/**
 * Calendar markers on Google — routed by what the marker is actually saying.
 *
 * Productions are studio property and belong on the one calendar the team
 * shares. Markers split in two:
 *
 *  - *Availability* — Out of Office, Travel Day, Available. These describe a
 *    person's week, so each connected account gets its own copy: the marker
 *    sits on your own calendar next to your dentist appointment, and everyone
 *    still sees that you're out.
 *  - *Scheduling* — Hold, Booked, Meeting, Planning, Edit Day. These are studio
 *    bookings and go to the studio calendar alone. Mirroring them would put
 *    every hold the team takes onto five personal calendars, which is noise:
 *    anyone who wants them already has the studio calendar shared to them.
 *
 * Either way they stay visible to the whole team — a Hold a producer drops that
 * nobody else can see is the exact failure that started all of this.
 *
 * `calendar_events.google_event_id` cannot express a mirrored marker: it is one
 * column, and a copy per calendar means an id per calendar. Those live in
 * calendar_event_google_links instead; the old column keeps its original job of
 * identifying markers imported *from* Google.
 */

/**
 * Presets that describe a person rather than a booking, so they mirror onto
 * every connected calendar. Everything else is a studio booking and goes to the
 * studio calendar alone — change a preset's side by moving it in or out here.
 */
const AVAILABILITY_PRESETS = new Set(['timeout', 'travel', 'available']);

/** True when this marker belongs on everyone's own calendar. */
export function isAvailabilityMarker(preset: string | null | undefined): boolean {
  return AVAILABILITY_PRESETS.has((preset || '').trim());
}

export interface MarkerCalendarPlan {
  /** Accounts that should hold a copy after this push. */
  targets: string[];
  /**
   * Accounts holding a copy that shouldn't have one any more — the case when a
   * marker's preset is edited from Out of Office to Hold, which narrows it from
   * everyone's calendar to the studio's. Their copies are deleted, or the
   * marker lingers on calendars it no longer belongs on.
   */
  prune: string[];
}

/**
 * Work out which calendars a marker belongs on, and which to clean up.
 *
 * A studio-only marker with no studio calendar resolved falls back to mirroring
 * rather than going nowhere: a marker on too many calendars is noise, but a
 * marker on none is the invisible-hold bug all over again.
 */
export function markerCalendarPlan(
  preset: string | null | undefined,
  allAccounts: string[],
  studioUserId: string | null,
  linkedUserIds: string[]
): MarkerCalendarPlan {
  const studioOnly = !isAvailabilityMarker(preset) && !!studioUserId;
  const onStudio = allAccounts.filter(id => id === studioUserId);

  // An env override can name an account that never connected, leaving nothing
  // to filter down to. Mirror rather than push the marker nowhere.
  const targets = studioOnly && onStudio.length > 0 ? onStudio : allAccounts;

  const wanted = new Set(targets);
  return { targets, prune: linkedUserIds.filter(id => !wanted.has(id)) };
}

/** Google colour ids per marker preset, so a Hold reads as a Hold in both places. */
const GOOGLE_COLOR_BY_PRESET: Record<string, string> = {
  hold: '5',       // Banana
  timeout: '4',    // Flamingo
  booked: '10',    // Basil
  meeting: '7',    // Peacock
  planning: '1',   // Lavender
  available: '2',  // Sage
  travel: '9',     // Blueberry
  edit: '3',       // Grape
};

/** Display names for marker presets, for the event description. */
const PRESET_LABELS: Record<string, string> = {
  hold: 'Hold',
  timeout: 'Out of Office',
  booked: 'Booked',
  meeting: 'Meeting',
  planning: 'Planning Shoot',
  available: 'Available',
  travel: 'Travel Day',
  edit: 'Edit Day',
};

export interface MarkerFanoutResult {
  /** Calendars the marker now appears on. */
  synced: number;
  /** Calendars that refused it. Reported, not thrown: the row is already saved. */
  failed: number;
  /** True when nothing was attempted because no account is connected. */
  noAccounts: boolean;
}

export function buildMarkerEventBody(event: any): Record<string, any> {
  const timing = buildGoogleTiming({
    startDate: event.event_date,
    endDate: event.end_date,
    startTime: event.start_time,
    endTime: event.end_time,
    defaultDurationHours: DEFAULT_MARKER_HOURS,
  });

  return {
    summary: event.title || 'Untitled',
    description: buildMarkerDescription({
      notes: event.notes,
      presetLabel: PRESET_LABELS[event.preset] || null,
      event_date: event.event_date,
      end_date: event.end_date,
      start_time: event.start_time,
      end_time: event.end_time,
    }),
    start: timing.start,
    end: timing.end,
    colorId: GOOGLE_COLOR_BY_PRESET[event.preset] || undefined,
    extendedProperties: { private: { app: STUDIO_MARKER_TAG, studioEventId: event.id } },
  };
}

/** Every account with a Google connection — one marker copy each. */
async function connectedUserIds(): Promise<string[]> {
  const { data } = await supabaseAdmin.from('google_tokens').select('id');
  return (data || []).map((row: any) => row.id as string);
}

interface MarkerLinks {
  /** Google event id per account holding a copy. */
  links: Map<string, string>;
  /**
   * False on a database that hasn't run the links migration. Mirroring needs
   * somewhere to write each calendar's id back to; without it every push would
   * look like a first push and stack a fresh copy on every calendar, every
   * save. Callers fall back to the single-calendar behaviour instead.
   */
  available: boolean;
}

/** This marker's existing copy on each calendar, keyed by account. */
async function linksFor(eventId: string): Promise<MarkerLinks> {
  const { data, error } = await supabaseAdmin
    .from('calendar_event_google_links')
    .select('user_id, google_event_id')
    .eq('event_id', eventId);

  if (error) {
    console.warn('Could not read marker links:', error.message);
    return { links: new Map(), available: false };
  }

  return {
    links: new Map((data || []).map((row: any) => [row.user_id as string, row.google_event_id as string])),
    available: true,
  };
}

/**
 * Mirror one marker onto every connected calendar.
 *
 * Each account keeps its own copy and its own event id, so one person deleting
 * their copy in Google leaves everyone else's — and the Slate row — alone.
 * Markers imported from Google are skipped: Google owns those, and pushing one
 * back would fight the next sync.
 */
export async function pushMarkerToAllCalendars(eventId: string): Promise<MarkerFanoutResult> {
  const { data: event, error } = await supabaseAdmin
    .from('calendar_events')
    .select('*')
    .eq('id', eventId)
    .single();

  if (error || !event) throw new Error('Event not found');
  if (event.preset === 'google') return { synced: 0, failed: 0, noAccounts: false };

  const [allAccounts, { links, available }, studio] = await Promise.all([
    connectedUserIds(),
    linksFor(eventId),
    resolveStudioCalendarUserId(null),
  ]);
  if (allAccounts.length === 0) return { synced: 0, failed: 0, noAccounts: true };

  // Without the links table there is nowhere to record a per-calendar id, so
  // mirroring would stack a fresh copy on every calendar every save. Fall back
  // to what the single google_event_id column can express: one copy, on the
  // studio calendar, whatever the preset says.
  const plan = available
    ? markerCalendarPlan(event.preset, allAccounts, studio.userId, Array.from(links.keys()))
    : { targets: allAccounts.filter(id => id === (studio.userId ?? allAccounts[0])), prune: [] };

  const accounts = plan.targets;

  const eventBody = buildMarkerEventBody(event);
  let synced = 0;
  let failed = 0;

  // Sequential: a handful of accounts, and parallel writes trip Google's
  // per-user rate limit for no meaningful gain.
  for (const userId of accounts) {
    try {
      const token = await getValidGoogleToken(userId);
      if (!token) {
        failed++;
        continue;
      }

      const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
      const create = () => fetch(EVENTS_URL, { method: 'POST', headers, body: JSON.stringify(eventBody) });

      // The legacy column covers a marker pushed before the links table
      // existed: whichever calendar actually holds that event updates it in
      // place, and the rest get a 404 and create their own copy.
      const existingId = links.get(userId) || (links.size === 0 ? event.google_event_id : null);

      let res: Response;
      if (existingId) {
        res = await fetch(`${EVENTS_URL}/${encodeURIComponent(existingId)}`, {
          method: 'PUT',
          headers,
          body: JSON.stringify(eventBody),
        });
        // 404 = deleted, 410 = cancelled. Neither can be updated in place.
        if (res.status === 404 || res.status === 410) res = await create();
      } else {
        res = await create();
      }

      if (!res.ok) {
        console.warn(`Marker push failed for ${userId} (${res.status}):`, (await res.text()).slice(0, 300));
        failed++;
        continue;
      }

      const created = await res.json();
      if (created.id && available) {
        await supabaseAdmin
          .from('calendar_event_google_links')
          .upsert(
            { event_id: eventId, user_id: userId, google_event_id: created.id, updated_at: new Date().toISOString() },
            { onConflict: 'event_id,user_id' }
          );
      } else if (created.id && created.id !== event.google_event_id) {
        // Pre-migration: the single column is the only place to keep it, and
        // keeping it is what stops the next save creating a second copy.
        await supabaseAdmin
          .from('calendar_events')
          .update({ google_event_id: created.id })
          .eq('id', eventId);
      }
      synced++;
    } catch (err: any) {
      console.warn(`Marker push failed for ${userId}:`, err?.message);
      failed++;
    }
  }

  // A preset edited from Out of Office to Hold narrows the marker from every
  // calendar to the studio's. Without this the old copies stay put, showing
  // someone as away on a day they are simply booked.
  for (const userId of plan.prune) {
    const staleId = links.get(userId);
    if (!staleId) continue;
    try {
      const token = await getValidGoogleToken(userId);
      if (token) await deleteEventFrom(token, staleId);
      await supabaseAdmin
        .from('calendar_event_google_links')
        .delete()
        .eq('event_id', eventId)
        .eq('user_id', userId);
    } catch (err: any) {
      console.warn(`Could not prune the marker copy on ${userId}:`, err?.message);
    }
  }

  return { synced, failed, noAccounts: false };
}

/**
 * Remove a marker's copies from every calendar holding one.
 *
 * Called before the row is deleted, while the links are still there to read.
 * The legacy column is swept too, so a marker pushed before the links table
 * existed doesn't outlive its row and get re-imported as a brand new marker.
 */
export interface MarkerDeletionTarget {
  userId: string;
  googleEventId: string;
}

/**
 * Every (calendar, event id) pair holding a copy of this marker.
 *
 * The links say exactly where each mirrored copy lives. A marker pushed before
 * the links table existed has only the legacy column — one id, no record of
 * whose calendar it is on — so that one has to be tried everywhere. Skipped
 * when a link already claims it, which is the normal case once a marker has
 * been re-pushed since the migration: sweeping then would delete a live copy
 * off every other calendar.
 */
export function markerDeletionTargets(
  links: Map<string, string>,
  legacyGoogleEventId: string | null | undefined,
  accounts: string[]
): MarkerDeletionTarget[] {
  const targets: MarkerDeletionTarget[] = [];
  for (const [userId, googleEventId] of links) targets.push({ userId, googleEventId });

  if (legacyGoogleEventId && !Array.from(links.values()).includes(legacyGoogleEventId)) {
    for (const userId of accounts) {
      targets.push({ userId, googleEventId: legacyGoogleEventId });
    }
  }

  return targets;
}

export async function removeMarkerFromAllCalendars(eventId: string): Promise<void> {
  const { data: event } = await supabaseAdmin
    .from('calendar_events')
    .select('google_event_id')
    .eq('id', eventId)
    .maybeSingle();

  const { links } = await linksFor(eventId);
  const needsSweep = !!event?.google_event_id && !Array.from(links.values()).includes(event.google_event_id);
  const targets = markerDeletionTargets(
    links,
    event?.google_event_id,
    needsSweep ? await connectedUserIds() : []
  );

  for (const target of targets) {
    try {
      const token = await getValidGoogleToken(target.userId);
      if (!token) continue;
      await deleteEventFrom(token, target.googleEventId);
    } catch (err: any) {
      // An event left on one calendar is untidy; failing the delete would
      // leave the marker in Slate, which is worse.
      console.warn(`Could not remove marker copy from ${target.userId}:`, err?.message);
    }
  }

  // The rows go with the marker anyway (ON DELETE CASCADE), but clearing them
  // here keeps a delete that leaves the row in place from re-using dead ids.
  await supabaseAdmin.from('calendar_event_google_links').delete().eq('event_id', eventId);
}
