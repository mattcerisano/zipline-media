import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUserId } from '@/lib/api-auth';

// Disconnect the caller's Google account: deletes their stored OAuth tokens.
// Identity comes from the verified Supabase session — a user can only ever
// disconnect themselves.
export async function POST(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: 'Server is not configured.' }, { status: 500 });
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await admin.from('google_tokens').delete().eq('id', userId);
  if (error) {
    console.error('Failed to disconnect Google account:', error);
    return NextResponse.json({ error: 'Failed to disconnect.' }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
