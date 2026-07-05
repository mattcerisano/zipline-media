// Brand theming. The entire UI keys its accent off the `--accent` CSS variable
// (Tailwind's `accent` color and every `accent/NN` opacity variant resolve to
// it). Setting that one variable on the document root re-skins the whole app to
// an organization's brand color. We also cache the value in localStorage so it
// can be applied before first paint on the next visit (no flash of default blue).

const ACCENT_CACHE_KEY = 'studio-os-accent';
const DEFAULT_ACCENT = '#0077FF';

function normalizeHex(hex: string): string | null {
  const clean = (hex || '').trim();
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(clean);
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h.toLowerCase()}`;
}

/** Apply a brand color to the whole app and cache it for next load. */
export function applyAccent(hex: string): void {
  const normalized = normalizeHex(hex);
  if (!normalized || typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--accent', normalized);
  try {
    localStorage.setItem(ACCENT_CACHE_KEY, normalized);
  } catch {
    /* localStorage unavailable — the color still applies for this session */
  }
}

/** Apply the cached brand color immediately (call before the DB round-trip). */
export function applyCachedAccent(): void {
  if (typeof document === 'undefined') return;
  try {
    const cached = localStorage.getItem(ACCENT_CACHE_KEY);
    const normalized = cached && normalizeHex(cached);
    if (normalized) document.documentElement.style.setProperty('--accent', normalized);
  } catch {
    /* ignore */
  }
}

/** Reset back to the product default accent (used if branding is cleared). */
export function resetAccent(): void {
  if (typeof document === 'undefined') return;
  document.documentElement.style.setProperty('--accent', DEFAULT_ACCENT);
  try {
    localStorage.removeItem(ACCENT_CACHE_KEY);
  } catch {
    /* ignore */
  }
}

function toHex(n: number): string {
  return Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
}

/**
 * Pull the dominant brand color out of a logo image, client-side (no external
 * service). Samples the image on a canvas, ignores transparent, near-white and
 * near-black pixels (logo backgrounds/outlines), and returns the most common
 * strongly-colored bucket — the closest thing to "read the brand's color".
 * Resolves to a hex string, or null if the image can't be read (e.g. CORS taint).
 */
export function extractBrandColorFromImage(src: string): Promise<string | null> {
  return new Promise((resolve) => {
    if (typeof document === 'undefined') return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onerror = () => resolve(null);
    img.onload = () => {
      try {
        const size = 64;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, size, size);
        const { data } = ctx.getImageData(0, 0, size, size);

        // Bucket colors coarsely (5 bits/channel) and weight each by how
        // saturated + far from white/black it is, so the true brand hue wins
        // over large flat neutral areas.
        const buckets = new Map<number, { r: number; g: number; b: number; weight: number }>();
        for (let i = 0; i < data.length; i += 4) {
          const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
          if (a < 200) continue; // skip transparent
          const max = Math.max(r, g, b), min = Math.min(r, g, b);
          const lightness = (max + min) / 2;
          if (lightness > 240 || lightness < 15) continue; // skip near-white/black
          const sat = max === 0 ? 0 : (max - min) / max;
          if (sat < 0.15) continue; // skip greys
          const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
          const weight = sat * (1 - Math.abs(lightness - 128) / 128) + 0.1;
          const entry = buckets.get(key);
          if (entry) {
            entry.r += r * weight; entry.g += g * weight; entry.b += b * weight; entry.weight += weight;
          } else {
            buckets.set(key, { r: r * weight, g: g * weight, b: b * weight, weight });
          }
        }

        if (buckets.size === 0) return resolve(null);
        let best: { r: number; g: number; b: number; weight: number } | null = null;
        for (const entry of buckets.values()) {
          if (!best || entry.weight > best.weight) best = entry;
        }
        if (!best) return resolve(null);
        resolve(`#${toHex(best.r / best.weight)}${toHex(best.g / best.weight)}${toHex(best.b / best.weight)}`);
      } catch {
        resolve(null); // canvas tainted or unreadable
      }
    };
    img.src = src;
  });
}
