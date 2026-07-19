import { authHeader } from '@/lib/api-client';

/**
 * @mention detection + fan-out, shared by every notes surface (Edit Tracker
 * cards, Notes Library). Mentions are matched against Rolodex contacts by
 * name; pings go to the team webhook channels (broadcast) and straight to the
 * mentioned people's devices via web push (matched by contact email → account
 * email, respecting their mention-pings preference).
 */

export interface MentionContact {
  id: string;
  name: string;
  email?: string | null;
}

/** Find @mentions of contacts in a text. Matches @First or @First_Last
 *  (case-insensitive) against contact names. */
export function findMentions<T extends MentionContact>(text: string, contacts: T[]): T[] {
  const tokens = Array.from(text.matchAll(/@([\w.]+)/g)).map(m => m[1].toLowerCase());
  if (tokens.length === 0) return [];
  return contacts.filter(c => {
    const first = (c.name || '').split(/\s+/)[0]?.toLowerCase();
    const full = (c.name || '').replace(/\s+/g, '_').toLowerCase();
    return tokens.some(t => t === first || t === full);
  });
}

/**
 * Ping contacts who are @mentioned in `newText` but weren't in `oldText`.
 * Fire-and-forget: failures log to the console and never block the save that
 * triggered them. Returns the newly mentioned contacts (empty if none).
 */
export function notifyNewMentions<T extends MentionContact>(options: {
  oldText: string;
  newText: string;
  contacts: T[];
  /** Where the mention happened, e.g. `"Nike Spot" (Edit Tracker)`. */
  context: string;
  /** In-app path for the push notification tap. */
  url?: string;
}): T[] {
  const { oldText, newText, contacts, context, url } = options;
  const before = new Set(findMentions(oldText || '', contacts).map(c => c.id));
  const added = findMentions(newText || '', contacts).filter(c => !before.has(c.id));
  if (added.length === 0) return [];

  const trimmed = newText.trim();
  const excerpt = trimmed.length > 160 ? `${trimmed.slice(0, 160)}…` : trimmed;

  // Team channels (Discord / Slack / Teams) — broadcast to everyone.
  const names = added.map(c => `**${c.name}**`).join(', ');
  fetch('/api/integrations/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `💬 ${names} mentioned on ${context}:\n${excerpt}` }),
  }).catch(err => console.error('Mention notification failed:', err));

  // Web push — only the mentioned people's own devices.
  const emails = added.map(c => c.email).filter((e): e is string => !!e);
  if (emails.length > 0) {
    authHeader()
      .then(headers =>
        fetch('/api/push/mention', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...headers },
          body: JSON.stringify({
            emails,
            title: `💬 Mentioned on ${context}`,
            body: excerpt,
            url: url || '/command-center',
          }),
        })
      )
      .catch(err => console.error('Mention push failed:', err));
  }

  return added;
}
