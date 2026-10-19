/**
 * Alerts that are on until someone turns them off.
 *
 * The Edit Tracker's "ready for review" and "delivered" pings predate the
 * configurable alert events and always fired. Making them events must not
 * silently stop them for a studio that has never opened the Alerts settings,
 * so with no saved row they send with this wording. A saved row — enabled or
 * not, with its own message — always wins.
 *
 * Shared by the dispatch route and the Alerts settings, so the toggle shows
 * what will actually happen.
 */
export const DEFAULT_EVENT_TEMPLATES: Record<string, string> = {
  edit_review: '✂️ **Edit ready for review:** {title} ({client}) · Editor: {editor}\n{review_link}',
  edit_delivered: '✅ **Final delivery complete:** {title} ({client}) · Editor: {editor}',
};

/**
 * The message an event sends, or null when it shouldn't send. A saved rule
 * decides when there is one (disabled means silent, a blank message falls back
 * to the default wording); with none, only a default-on alert sends.
 */
export function resolveEventTemplate(
  eventKey: string,
  rule: { enabled?: boolean | null; message_template?: string | null } | null | undefined,
): string | null {
  const fallback = DEFAULT_EVENT_TEMPLATES[eventKey] ?? null;
  if (!rule) return fallback;
  if (!rule.enabled) return null;
  return rule.message_template?.trim() ? rule.message_template : fallback;
}
