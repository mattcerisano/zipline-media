/**
 * Gmail's `snippet` is HTML-escaped ("wahooooo &lt;3"). It's shown as plain
 * text, so the entities have to be turned back into characters first —
 * otherwise previews read "&lt;", "&amp;" and "&#39;".
 */
const NAMED: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, body: string) => {
    if (body[0] === '#') {
      const code = body[1] === 'x' || body[1] === 'X' ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : whole;
    }
    return NAMED[body.toLowerCase()] ?? whole;
  });
}
