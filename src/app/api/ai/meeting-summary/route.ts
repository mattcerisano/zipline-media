import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthedUserId } from '@/lib/api-auth';
import { isSameOrigin } from '@/lib/api-guard';

/**
 * Claude-written summary of a meeting note.
 *
 * Until now the "AI Executive Summary" card on Meeting Notes was a stage prop:
 * it waited two seconds and then pasted in a fixed template ("Aligned on
 * project deliverables and execution roadmap", "Finalize production contract
 * paperwork") whatever the note said, and that invented text was stored on
 * the client's record. This route reads the note that was actually written
 * and returns a summary of only what is in it.
 *
 * Suggest-only: the summary comes back to the browser, where the person
 * looking at the note decides whether to keep it. Nothing here writes to the
 * database. The API key stays server-side.
 */

export const maxDuration = 60;

const MODEL = 'claude-opus-5-5';

/** A note longer than this is more than a meeting; keep the request bounded. */
const MAX_NOTE_CHARS = 60_000;

const SYSTEM = `You summarise meeting notes for a video production studio. The notes are typed during or just after a call with a client.

Write a short executive summary in Markdown with these sections, each a few bullets:

### Key points
### Decisions
### Open items

Use only what the notes say. If a section has nothing to go in it, write "- Nothing recorded." under it rather than inventing content. Keep names, dates, prices and deliverables exactly as written. Do not add advice, pleasantries, or a preamble; start with the first heading.`;

export async function POST(request: Request) {
  if (!isSameOrigin(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  if (!(await getAuthedUserId(request))) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: 'The assistant is not configured — set ANTHROPIC_API_KEY in the environment.' },
      { status: 501 },
    );
  }

  try {
    const body = await request.json();
    const note = body?.note || {};
    const content = typeof note.content === 'string' ? note.content.trim() : '';
    if (!content) {
      return NextResponse.json({ error: 'Write the meeting notes first, then summarise them.' }, { status: 400 });
    }
    if (content.length > MAX_NOTE_CHARS) {
      return NextResponse.json({ error: 'This note is too long to summarise in one go.' }, { status: 400 });
    }

    const attendees = Array.isArray(note.attendees) ? note.attendees.filter((a: unknown) => typeof a === 'string') : [];
    const actionItems = Array.isArray(note.action_items)
      ? note.action_items
          .filter((i: any) => i && typeof i.text === 'string')
          .map((i: any) => `- [${i.completed ? 'x' : ' '}] ${i.text}${i.due_date ? ` (due ${i.due_date})` : ''}`)
      : [];

    const context = [
      note.title && `Title: ${note.title}`,
      note.client_name && `Client: ${note.client_name}`,
      note.meeting_date && `Date: ${note.meeting_date}`,
      note.objective && `Objective: ${note.objective}`,
      attendees.length > 0 && `Attendees: ${attendees.join(', ')}`,
      actionItems.length > 0 && `Action items already logged:\n${actionItems.join('\n')}`,
    ].filter(Boolean).join('\n');

    const client = new Anthropic({ apiKey });

    const params = {
      model: MODEL,
      max_tokens: 2000,
      // A short summary of a short note: low effort keeps it quick and cheap.
      output_config: { effort: 'low' as const },
      system: SYSTEM,
      messages: [{
        role: 'user' as const,
        content: `${context ? context + '\n\n' : ''}Meeting notes:\n\n${content}`,
      }],
    };

    let response;
    try {
      // A safety decline is re-run on Anthropic's recommended fallback rather
      // than surfacing as a dead end.
      response = await client.beta.messages.create({
        ...params,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      } as any);
    } catch (err: any) {
      // The fallback parameter is gated behind a beta the account may not
      // have. Drop it and retry rather than lose the whole feature.
      const gated = err?.status === 400 && /fallback|beta/i.test(err?.message || '');
      if (!gated) throw err;
      console.warn('Server-side fallbacks unavailable; retrying without them.');
      response = await client.messages.create(params);
    }

    if (response.stop_reason === 'refusal') {
      return NextResponse.json({ error: 'The assistant declined to summarise this note.' }, { status: 422 });
    }

    const text = response.content.find(b => b.type === 'text');
    if (!text || text.type !== 'text' || !text.text.trim()) {
      return NextResponse.json({ error: 'The assistant returned no summary.' }, { status: 502 });
    }

    return NextResponse.json({ summary: text.text.trim() });
  } catch (err: any) {
    console.error('Meeting summary error:', err?.message);
    const status = err?.status === 429 ? 429 : 500;
    return NextResponse.json(
      { error: status === 429 ? 'The assistant is rate limited — try again shortly.' : 'The assistant could not be reached.' },
      { status },
    );
  }
}
