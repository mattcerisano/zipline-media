import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

/**
 * A guard, not a style preference.
 *
 * The app renders 8px and 9px labels that are legible on a desktop monitor and
 * unreadable on a phone. A pass replaced every one of them with
 * `text-[11px] md:text-[9px]` — small where there's room, readable where there
 * isn't. Two of them came straight back a few PRs later, in code written after
 * the pass, because nothing was watching.
 *
 * This is what watches. It scans the real source tree rather than a fixture, so
 * it fails on the next one too.
 */

const SRC = new URL('..', import.meta.url).pathname;

/** `text-[9px]` not immediately preceded by a breakpoint prefix. */
const UNGUARDED = /(?<![a-z0-9]:)text-\[[0-9]px\]/g;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap(entry => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry) ? [path] : [];
  });
}

describe('mobile text sizes', () => {
  it('has no single-digit-px text without a breakpoint prefix', () => {
    const offenders: string[] = [];

    for (const path of sourceFiles(SRC)) {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        for (const hit of line.match(UNGUARDED) || []) {
          offenders.push(`${path.replace(SRC, 'src/')}:${i + 1}  ${hit}`);
        }
      });
    }

    expect(
      offenders,
      `Text below 10px is unreadable on a phone. Write it as \`text-[11px] md:text-[Npx]\`\n` +
        `so it only shrinks where there's room:\n\n${offenders.join('\n')}\n`,
    ).toEqual([]);
  });

  it('detects an unguarded size but accepts a breakpoint-prefixed one', () => {
    // Guards the guard: a regex that matched nothing would pass the test above
    // forever without anyone noticing.
    expect('text-[9px] font-black'.match(UNGUARDED)).toHaveLength(1);
    expect('text-[11px] md:text-[9px]'.match(UNGUARDED)).toBeNull();
    expect('text-[11px] lg:text-[8px]'.match(UNGUARDED)).toBeNull();
    expect('text-[10px]'.match(UNGUARDED)).toBeNull();
  });
});
