// In-browser semantic search. A small sentence-embedding model
// (all-MiniLM-L6-v2, ~23MB quantized) runs entirely client-side via
// Transformers.js — no server, no API key, nothing leaves the browser. Queries
// like "beverage shoot with the crane" can match a job titled "Coca-Cola
// Rooftop Spot" even with zero keyword overlap.
//
// The model is loaded lazily the first time search is opened, and every
// document embedding is cached in localStorage keyed by a content hash, so
// after the first pass only new/edited records are re-embedded. If the model
// can't load (offline, old browser, blocked CDN), callers fall back to the
// keyword scorer below — search always works, semantics are an upgrade.

export interface SearchDoc {
  key: string;   // stable id, e.g. "job:<uuid>"
  text: string;  // concatenated searchable text
}

export type SemanticStatus = 'idle' | 'loading' | 'ready' | 'unavailable';

let status: SemanticStatus = 'idle';
let extractor: ((texts: string[], opts: any) => Promise<any>) | null = null;
let loadPromise: Promise<boolean> | null = null;

const EMB_CACHE_KEY = 'studio_semantic_cache_v1';
const EMB_DIMS = 384;

export function getSemanticStatus(): SemanticStatus {
  return status;
}

/** Kick off (or await) model load. Resolves true when embeddings are usable. */
export function ensureModel(onProgress?: (pct: number) => void): Promise<boolean> {
  if (status === 'ready') return Promise.resolve(true);
  if (status === 'unavailable') return Promise.resolve(false);
  if (loadPromise) return loadPromise;

  status = 'loading';
  loadPromise = (async () => {
    try {
      const { pipeline } = await import('@huggingface/transformers');
      const pipe = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
        dtype: 'q8',
        progress_callback: (p: any) => {
          if (onProgress && p?.status === 'progress' && p.total) {
            onProgress(Math.round((p.loaded / p.total) * 100));
          }
        },
      } as any);
      extractor = pipe as any;
      status = 'ready';
      return true;
    } catch (err) {
      console.warn('Semantic search model unavailable, using keyword search:', err);
      status = 'unavailable';
      return false;
    }
  })();
  return loadPromise;
}

// djb2 — cheap content hash to detect stale cached embeddings.
function hashText(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return h.toString(36);
}

type EmbCache = Record<string, { h: string; v: number[] }>;

function readCache(): EmbCache {
  try {
    return JSON.parse(localStorage.getItem(EMB_CACHE_KEY) || '{}');
  } catch {
    return {};
  }
}

function writeCache(cache: EmbCache): void {
  try {
    localStorage.setItem(EMB_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Quota exceeded — drop the cache; embeddings just recompute next time.
    try { localStorage.removeItem(EMB_CACHE_KEY); } catch { /* ignore */ }
  }
}

async function embed(texts: string[]): Promise<number[][]> {
  if (!extractor) throw new Error('model not loaded');
  const out: any = await (extractor as any)(texts, { pooling: 'mean', normalize: true });
  // Tensor → array of row vectors, rounded to shrink the localStorage cache.
  const flat: number[] = Array.from(out.data as Float32Array);
  const rows: number[][] = [];
  for (let i = 0; i < texts.length; i++) {
    rows.push(flat.slice(i * EMB_DIMS, (i + 1) * EMB_DIMS).map(n => Math.round(n * 1e4) / 1e4));
  }
  return rows;
}

function cosine(a: number[], b: number[]): number {
  // Vectors are L2-normalized at embed time, so the dot product is the cosine.
  let dot = 0;
  for (let i = 0; i < a.length && i < b.length; i++) dot += a[i] * b[i];
  return dot;
}

/**
 * Rank docs against a query semantically. Returns key → similarity in [~-1, 1],
 * or null when the model isn't ready (caller uses keyword scores alone).
 * Embeds uncached/changed docs in small batches to keep the UI responsive.
 */
export async function semanticRank(
  query: string,
  docs: SearchDoc[]
): Promise<Map<string, number> | null> {
  if (status !== 'ready' || !extractor) return null;

  const cache = readCache();
  const missing = docs.filter(d => {
    const c = cache[d.key];
    return !c || c.h !== hashText(d.text);
  });

  const BATCH = 16;
  for (let i = 0; i < missing.length; i += BATCH) {
    const batch = missing.slice(i, i + BATCH);
    const vecs = await embed(batch.map(d => d.text));
    batch.forEach((d, j) => {
      cache[d.key] = { h: hashText(d.text), v: vecs[j] };
    });
  }
  if (missing.length > 0) {
    // Prune cache entries for docs that no longer exist before persisting.
    const live = new Set(docs.map(d => d.key));
    for (const k of Object.keys(cache)) if (!live.has(k)) delete cache[k];
    writeCache(cache);
  }

  const [qVec] = await embed([query]);
  const scores = new Map<string, number>();
  for (const d of docs) {
    const c = cache[d.key];
    if (c) scores.set(d.key, cosine(qVec, c.v));
  }
  return scores;
}

/**
 * Keyword score in [0, 1]: exact substring beats all-tokens-present beats
 * partial token hits. Always available — the floor the semantic score builds on.
 */
export function keywordScore(query: string, text: string): number {
  const q = query.toLowerCase().trim();
  const t = text.toLowerCase();
  if (!q) return 0;
  if (t.includes(q)) return 1;
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return 0;
  const hits = tokens.filter(tok => t.includes(tok)).length;
  return (hits / tokens.length) * 0.75;
}

/** Blend keyword + semantic. Semantic only adds, never buries an exact match. */
export function combinedScore(kw: number, sem: number | undefined): number {
  if (sem === undefined) return kw;
  return Math.max(kw, sem * 0.9) + Math.min(kw, sem * 0.9) * 0.25;
}
