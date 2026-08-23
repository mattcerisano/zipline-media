import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/api-auth';

// Designate which connected Google account is *the* studio calendar.
//
// Slate pushes every production to one calendar — see src/lib/studio-calendar.ts
// for why the schema allows only one. A one-person studio never needs this
// (a sole connected account is the studio calendar by default); it matters as
// soon as a second person connects, because until someone chooses, pushes fall
// back to whoever hit Save and productions scatter again.

// Mirrors the primary-administrator bypass used at login and in team
// management, so the org owner can set this even without a user_roles row.
const OWNER_EMAIL = 'matt@zipline.media';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function POST(request: Request) {
  const caller = await getAuthedUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const admin = getAdminClient();
  if (!admin) {
    return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });
  }

  // Admin-only: this redirects where every production on the board lands.
  if (caller.email !== OWNER_EMAIL) {
    const { data } = await admin.from('user_roles').select('role').eq('id', caller.id).maybeSingle();
    if (data?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
  }

  const { data: connection } = await admin
    .from('google_tokens')
    .select('id')
    .eq('id', caller.id)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json(
      { error: 'Connect this account to Google before making it the studio calendar.' },
      { status: 400 }
    );
  }

  // Clear first: a unique partial index allows only one true, so setting the
  // new one before releasing the old would collide.
  const { error: clearErr } = await admin
    .from('google_tokens')
    .update({ is_studio_calendar: false })
    .neq('id', caller.id);

  if (clearErr) {
    // The column is missing on databases that haven't run the migration —
    // worth saying plainly rather than surfacing a raw Postgres error.
    const missing = /is_studio_calendar|schema cache/i.test(clearErr.message || '');
    return NextResponse.json(
      {
        error: missing
          ? 'Run the studio-calendar migration before designating a calendar.'
          : clearErr.message,
      },
      { status: 500 }
    );
  }

  const { error: setErr } = await admin
    .from('google_tokens')
    .update({ is_studio_calendar: true })
    .eq('id', caller.id);

  if (setErr) {
    return NextResponse.json({ error: setErr.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, isStudioCalendar: true });
}
