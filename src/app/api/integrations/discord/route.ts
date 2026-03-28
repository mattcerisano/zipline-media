import { NextResponse } from 'next/server';

const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

export async function POST(request: Request) {
  if (!DISCORD_WEBHOOK_URL) {
    return NextResponse.json({ error: 'Discord Webhook URL not configured' }, { status: 500 });
  }

  try {
    const { message, embed } = await request.json();

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
