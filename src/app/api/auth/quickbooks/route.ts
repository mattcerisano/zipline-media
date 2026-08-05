import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/api-auth';
import { signOAuthState } from '@/lib/oauth-state';
import { QB_SCOPE } from '@/lib/quickbooks-auth';

// Returns the Intuit consent URL for the *authenticated* caller. Same pattern
// as the Google connect route: the user id comes from the verified session and
// travels in a signed state, so a connection can only ever be bound to the
// account that started it.
export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const clientId = process.env.QUICKBOOKS_CLIENT_ID;
  const redirectUri =
    process.env.QUICKBOOKS_REDIRECT_URI ||
    `${new URL(request.url).origin}/api/auth/quickbooks/callback`;

  if (!clientId) {
    return NextResponse.json({ error: 'QuickBooks credentials are not configured.' }, { status: 500 });
  }

  const url =
    `https://appcenter.intuit.com/connect/oauth2?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(QB_SCOPE)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&state=${encodeURIComponent(signOAuthState(userId))}`;

  return NextResponse.json({ url });
}
