import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/api-auth';
import { isPushConfigured, sendToUsers } from '@/lib/push';

// "Send test" from the push settings card — pushes a canned notification to
// every device the caller has registered, so they can confirm the pipe works
// end-to-end (VAPID keys, service worker, OS notification permission).

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'Push is not configured on the server (VAPID keys missing).' }, { status: 500 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY missing).' }, { status: 500 });
  }

  const result = await sendToUsers(supabaseAdmin, [user.id], {
    title: '🛠️ Zipline Studio OS test',
    body: 'Push notifications are working on this device.',
    url: '/command-center',
    tag: 'push-test',
  });

  if (result.sent === 0) {
    const reason = result.pruned > 0
      ? 'Your subscription had expired and was cleaned up — enable push again on this device.'
      : 'No registered devices found — enable push on this device first.';
    return NextResponse.json({ error: reason, ...result }, { status: 400 });
  }
  return NextResponse.json({ success: true, ...result });
}
