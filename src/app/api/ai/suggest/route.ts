import { NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getAuthedUserId } from '@/lib/api-auth';
import { isSameOrigin } from '@/lib/api-guard';

/**
 * Claude-backed suggestions for Studio OS.
 *
 * Suggest-only by design: this route returns a proposal and never writes to the
 * database. Applying a suggestion is a separate, explicit action taken by the
 * person looking at it — nothing here can silently rewrite a contact.
 *
 * The API key stays server-side; the browser only ever sees the suggestion.
 */

export const maxDuration = 30;

const MODEL = 'claude-opus-5';

/** Departments Studio OS already uses, so suggestions land on real filters. */
const DEPARTMENTS = [
  'Production', 'Camera', 'G&E / Lighting', 'Audio', 'Art',
  'Makeup', 'Wardrobe', 'Script', 'VFX', 'Post', 'Support', 'General',
];

const CONTACT_SCHEMA = {
  type: 'object',
  properties: {
    primary_role: {
      type: 'string',
      description: 'The single job title this person is hired for, e.g. "Gaffer", "Director of Photography". Empty string if genuinely unclear.',
    },
    department: {
      type: 'string',
      enum: DEPARTMENTS,
      description: 'Which department the role belongs to.',
    },
    tags: {
      type: 'array',
      items: { type: 'string' },
      description: 'Two to five short lowercase tags for filtering — skills, gear specialities, union status, or region. No punctuation.',
    },
    confidence: {
      type: 'string',
      enum: ['high', 'medium', 'low'],
      description: 'How well-supported the suggestion is by the details given.',
    },
    reasoning: {
      type: 'string',
      description: 'One short sentence naming the detail that drove the suggestion.',
    },
  },
  required: ['primary_role', 'department', 'tags', 'confidence', 'reasoning'],
  additionalProperties: false,
} as const;

const SYSTEM = `You categorise crew and vendor contacts for a video production studio's Rolodex.

Given whatever is known about a contact, infer their primary role, the department it belongs to, and a few tags useful for filtering a crew list.

Work only from the details provided. When something genuinely isn't determinable, say so through a low confidence rather than inventing a plausible-sounding role — a wrong role on a call sheet costs a shoot day. If an existing role is already recorded, keep it unless the other details clearly contradict it.

Tags are for finding people later: skills ("steadicam", "underwater"), gear they own, union status, or region. Keep them short and lowercase.`;

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
    if (body.action !== 'contact_tags') {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    const contact = body.contact || {};
    const known = [
      contact.name && `Name: ${contact.name}`,
      contact.company_name && `Company: ${contact.company_name}`,
      contact.email && `Email: ${contact.email}`,
      contact.primary_role && `Role already recorded: ${contact.primary_role}`,
      contact.tags && `Tags already recorded: ${contact.tags}`,
      [contact.location_city, contact.location_state, contact.location_country]
        .filter(Boolean).join(', ') || null,
      contact.notes_general && `Notes: ${contact.notes_general}`,
    ].filter(Boolean).join('\n');

    if (!known.trim()) {
      return NextResponse.json({ error: 'Not enough detail to suggest anything yet.' }, { status: 400 });
    }

    const client = new Anthropic({ apiKey });

    const params = {
      model: MODEL,
      max_tokens: 2000,
      // Low effort: this is a short classification, not a reasoning problem.
      // The schema is enforced server-side, so the response needs no parsing
      // guard beyond the refusal check below.
      output_config: {
        effort: 'low' as const,
        format: { type: 'json_schema' as const, schema: CONTACT_SCHEMA },
      },
      system: SYSTEM,
      messages: [{ role: 'user' as const, content: `Categorise this contact:\n\n${known}` }],
    };

    let response;
    try {
      // Recommended on this model: a safety decline is re-run on Anthropic's
      // recommended fallback rather than surfacing as a dead end.
      response = await client.beta.messages.create({
        ...params,
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      } as any);
    } catch (err: any) {
      // The fallback parameter is gated behind a beta the account may not
      // have. Rather than let that kill the whole feature, drop it and retry —
      // the only thing lost is automatic recovery from a safety decline.
      const gated = err?.status === 400 && /fallback|beta/i.test(err?.message || '');
      if (!gated) throw err;
      console.warn('Server-side fallbacks unavailable; retrying without them.');
      response = await client.messages.create(params);
    }

    // A refusal returns HTTP 200 with empty or partial content — checking
    // stop_reason before reading content is what keeps this from throwing.
    if (response.stop_reason === 'refusal') {
      return NextResponse.json(
        { error: 'The assistant declined to categorise this contact.' },
        { status: 422 },
      );
    }

    const text = response.content.find(b => b.type === 'text');
    if (!text || text.type !== 'text') {
      return NextResponse.json({ error: 'The assistant returned no suggestion.' }, { status: 502 });
    }

    return NextResponse.json({ suggestion: JSON.parse(text.text) });
  } catch (err: any) {
    console.error('AI suggestion error:', err?.message);
    const status = err?.status === 429 ? 429 : 500;
    return NextResponse.json(
      { error: status === 429 ? 'The assistant is rate limited — try again shortly.' : 'The assistant could not be reached.' },
      { status },
    );
  }
}
