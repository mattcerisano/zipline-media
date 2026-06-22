import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/google/callback';

  if (!clientId) {
    console.error('GOOGLE_CLIENT_ID is not configured in .env.local');
    return NextResponse.redirect(new URL('/command-center?google_error=credentials_missing', request.url));
  }

  // Request scopes for Google Calendar (two-way sync), Google Drive (file browser), and Gmail (inbox integration)
  const scopes = [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/drive.readonly',
    'https://www.googleapis.com/auth/gmail.modify'
  ].join(' ');

  const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
    `client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&response_type=code` +
    `&scope=${encodeURIComponent(scopes)}` +
    `&state=${encodeURIComponent(userId)}` +
    `&access_type=offline` +
    `&prompt=consent`;

  return NextResponse.redirect(googleAuthUrl);
}
