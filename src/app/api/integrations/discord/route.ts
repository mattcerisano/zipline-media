import { NextResponse } from 'next/server';
import { getAuthedUserId } from '@/lib/api-auth';
import { isSameOrigin } from '@/lib/api-guard';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;
const MAX_MESSAGE_LEN = 2000; // Discord's own limit; longer bodies are rejected upstream.

export async function POST(request: Request) {
  // This route posts to the studio's Discord with a server-side webhook URL.
  // Unauthenticated, it was an open relay: anyone who found the path could
  // push arbitrary messages into the team channel.
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!(await getAuthedUserId(request))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  if (!DISCORD_WEBHOOK_URL) {
    return NextResponse.json({ error: 'Discord Webhook URL not configured' }, { status: 500 });
  }

  try {
    const { message, embed } = await request.json();

    if (typeof message !== 'string' || !message.trim()) {
      return NextResponse.json({ error: 'A message is required' }, { status: 400 });
    }
    if (message.length > MAX_MESSAGE_LEN) {
      return NextResponse.json({ error: 'Message is too long' }, { status: 400 });
    }

    const payload = {
      content: message,
      embeds: embed ? [embed] : undefined,
    };

    const res = await fetch(DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Discord Webhook Error:', error);
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}
