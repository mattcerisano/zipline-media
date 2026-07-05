import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/api-auth';
import { signOAuthState } from '@/lib/oauth-state';

// Returns the Google consent URL for the *authenticated* caller. The client
// fetches this with its bearer token and then redirects the browser to `url`.
// The user id is taken from the verified session and embedded in a signed
// state, so a user can only ever start a connection for their own account.
export async function GET(request: Request) {
  const userId = await getAuthedUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

  if (!clientId) {
    console.error('GOOGLE_CLIENT_ID is not configured in .env.local');
    return NextResponse.json({ error: 'Google credentials are not configured.' }, { status: 500 });
  }

  // Request scopes for Google Calendar (two-way sync), Google Drive (file browser), and Gmail (inbox integration)
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ].join(' ');

  const state = signOAuthState(userId);

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(state)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.json({ url: googleAuthUrl });
}
