import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/api-auth';

// Hands the signed-in app the subscribable feed URL, with the shared secret
// already attached. The secret lives server-side, so the Integrations Hub can
// show a working "copy this into Google Calendar" link without the token being
// baked into the client bundle.
export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const token = process.env.CALENDAR_FEED_TOKEN;
  const origin = new URL(request.url).origin;
  const url = token
    ? `${origin}/api/calendar?token=${encodeURIComponent(token)}`
    : `${origin}/api/calendar`;

  return NextResponse.json({
    url,
    // Lets the UI warn that the feed is currently readable by anyone who
    // guesses the path, and point at the fix.
    secured: !!token,
  });
}
