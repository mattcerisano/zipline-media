import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthedUser } from '@/lib/api-auth';
import { isPushConfigured, getVapidPublicKey } from '@/lib/push';

// Device registration for web push. The client subscribes through here (not
// straight to Supabase) so user_email is stamped from the verified JWT — it's
// the bridge that lets crew emails on job_roles / Rolodex contacts resolve to
// push devices, so it can't be spoofed from the browser.

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder-url.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-key';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Public config for the settings UI: whether the server has VAPID keys, and
// the public key the browser needs to subscribe. Served at runtime instead of
// a NEXT_PUBLIC_ inline so a key added in Vercel works without a rebuild.
export async function GET() {
  return NextResponse.json({
    configured: isPushConfigured(),
    publicKey: getVapidPublicKey() || null,
  });
}

// Register (or refresh) this browser's push subscription.
export async function POST(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Server not configured (SUPABASE_SERVICE_ROLE_KEY missing).' }, { status: 500 });
  }

  const body = await request.json().catch(() => ({} as any));
  const sub = body?.subscription;
  const endpoint: string | undefined = sub?.endpoint;
  const p256dh: string | undefined = sub?.keys?.p256dh;
  const auth: string | undefined = sub?.keys?.auth;
  if (!endpoint || !p256dh || !auth) {
    return NextResponse.json({ error: 'Invalid subscription payload' }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from('push_subscriptions').upsert(
    {
      user_id: user.id,
      user_email: user.email,
      endpoint,
      p256dh,
      auth,
      user_agent: String(request.headers.get('user-agent') || '').slice(0, 300) || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'endpoint' }
  );
  if (error) {
    console.error('Push subscribe failed:', error);
    return NextResponse.json({ error: 'Could not save the subscription — run the latest database migrations.' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}

// Remove this browser's subscription (user turned push off on this device).
export async function DELETE(request: Request) {
  const user = await getAuthedUser(request);
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const body = await request.json().catch(() => ({} as any));
  const endpoint: string | undefined = body?.endpoint;
  if (!endpoint) {
    return NextResponse.json({ error: 'endpoint is required' }, { status: 400 });
  }

  // Scoped to the caller's own rows so one user can't deregister another's device.
  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('user_id', user.id);
  if (error) {
    console.error('Push unsubscribe failed:', error);
    return NextResponse.json({ error: 'Could not remove the subscription' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
