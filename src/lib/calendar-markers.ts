import { supabase } from '@/lib/supabase';
import { removeEventFromGoogleCalendar } from '@/lib/calendar-push';

/**
 * Take a calendar marker off the board, from wherever it is being removed —
 * the Calendar tab's delete, or Slate clearing the hold a production replaced.
 *
 * The two used to disagree, and the disagreement made duplicates. A marker
 * imported *from* Google isn't ours to delete: Google still has the event, so
 * a hard delete here just had the next sync import it again — right next to
 * the production it had been converted into. Those get a tombstone instead.
 * Markers the studio made are removed from Google first, then dropped.
 *
 * Pass the preset when it's to hand; otherwise the row is looked up, since
 * getting this wrong is exactly the bug.
 */
export async function retireMarker(id: string, preset?: string | null): Promise<void> {
  let kind = preset;
  if (kind === undefined) {
    const { data } = await supabase.from('calendar_events').select('preset').eq('id', id).maybeSingle();
    kind = (data as { preset?: string } | null)?.preset ?? null;
  }

  if (kind === 'google') {
    const { error } = await supabase.from('calendar_events').update({ hidden: true }).eq('id', id);
    if (!error) return;
    // A database without the `hidden` column can't tombstone; losing the row
    // (and seeing it come back on the next sync) beats failing to remove it.
  } else {
    // Ours, and mirrored to Google — clear the Google side first so it doesn't
    // outlive the row and get re-imported as a new marker. The Slate id goes
    // over, not a Google one: the marker has a copy (and an id) on every
    // connected calendar, and the server holds that list.
    await removeEventFromGoogleCalendar(id);
  }

  const { error } = await supabase.from('calendar_events').delete().eq('id', id);
  if (error) throw error;
}
