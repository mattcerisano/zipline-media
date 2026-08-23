import { createClient } from '@supabase/supabase-js';
import { getGoogleToken, describeTokenFailure } from '@/lib/google-auth';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

/**
 * Whose Google Calendar the studio's productions live on.
 *
 * Pushes used to go to whoever hit Save, so a shoot booked by a producer landed
 * on the producer's own calendar — or nowhere, if they had never connected
 * Google — and no one else ever saw it. `jobs.google_event_id` is a single
 * column, so one job can only ever point at one Google event: the schema has
 * always assumed a single studio calendar. This resolves which account owns it.
 */
export interface ConnectedAccount {
  id: string;
  is_studio_calendar?: boolean | null;
}

export type StudioCalendarSource = 'env' | 'designated' | 'sole' | 'acting';

export interface StudioCalendarPick {
  /** Null when there is nothing to go on and no acting user to fall back to. */
  userId: string | null;
  source: StudioCalendarSource;
}

/**
 * Choose the studio calendar's owner, in descending order of how deliberate
 * the choice was.
 *
 *  - `env`        — STUDIO_GOOGLE_USER_ID, the escape hatch for when nobody can
 *                   get into the UI to fix a bad designation.
 *  - `designated` — someone ticked this account in Integrations.
 *  - `sole`       — only one account is connected, so there is nothing to
 *                   choose between; a one-person studio needs no setup.
 *  - `acting`     — nothing to go on (several accounts, none designated). Falls
 *                   back to the old per-user behaviour rather than guessing
 *                   which colleague's calendar to write to. The background cron
 *                   has no acting user and gets null instead: it skips the push
 *                   rather than picking a calendar at random.
 */
export function pickStudioUserId(
  accounts: ConnectedAccount[],
  envOverride: string | null | undefined,
  actingUserId: string | null
): StudioCalendarPick {
  const override = (envOverride || '').trim();
  if (override) return { userId: override, source: 'env' };

  const designated = accounts.filter(a => a.is_studio_calendar);
  if (designated.length === 1) return { userId: designated[0].id, source: 'designated' };

  if (accounts.length === 1) return { userId: accounts[0].id, source: 'sole' };

  return { userId: actingUserId, source: 'acting' };
}

/** The connected accounts, tolerating a database that predates the flag. */
async function listConnectedAccounts(): Promise<ConnectedAccount[]> {
  const withFlag = await supabaseAdmin.from('google_tokens').select('id, is_studio_calendar');
  if (!withFlag.error) return (withFlag.data as ConnectedAccount[]) || [];

  const idOnly = await supabaseAdmin.from('google_tokens').select('id');
  return ((idOnly.data as ConnectedAccount[]) || []);
}

/** Resolve the studio calendar's owner for a request made by `actingUserId`. */
export async function resolveStudioCalendarUserId(actingUserId: string | null): Promise<StudioCalendarPick> {
  return pickStudioUserId(
    await listConnectedAccounts(),
    process.env.STUDIO_GOOGLE_USER_ID,
    actingUserId
  );
}

export interface StudioCalendarToken {
  token: string | null;
  userId: string | null;
  source: StudioCalendarSource;
  /** Ready for a toast: says which account is broken, not just "not connected". */
  message?: string;
}

/**
 * A usable Google token for the studio calendar.
 *
 * Deliberately does *not* fall back to the acting user when the studio account
 * itself is broken: writing a production to a colleague's personal calendar
 * instead is how the events got scattered in the first place. A clear "the
 * studio calendar needs reconnecting" beats a push that silently lands
 * somewhere nobody is looking.
 */
export async function getStudioCalendarToken(actingUserId: string | null): Promise<StudioCalendarToken> {
  const pick = await resolveStudioCalendarUserId(actingUserId);
  if (!pick.userId) {
    return {
      token: null,
      userId: null,
      source: pick.source,
      message:
        'No studio Google Calendar is set. Open Integrations on the account that should own the ' +
        'studio calendar and mark it as the studio calendar.',
    };
  }

  const result = await getGoogleToken(pick.userId);

  if (result.token) return { token: result.token, userId: pick.userId, source: pick.source };

  const detail = describeTokenFailure(result.failure || 'refresh_failed', result.detail);
  const message =
    pick.userId === actingUserId
      ? detail
      : `The studio Google Calendar needs attention — ${detail.charAt(0).toLowerCase()}${detail.slice(1)}`;

  return { token: null, userId: pick.userId, source: pick.source, message };
}
