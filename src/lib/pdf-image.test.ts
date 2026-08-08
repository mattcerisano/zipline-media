import { describe, it, expect } from 'vitest';
import { fitImageBox } from './pdf-image';

/**
 * The bug this guards: a 3000×3000 logo drawn into a 120×30 box came out four
 * times wider than tall. Nothing errored — it just looked wrong on every
 * exported call sheet and gear list.
 */

const docWith = (width: number, height: number) => ({ getImageProperties: () => ({ width, height }) });

describe('fitImageBox', () => {
  it('keeps a square logo square instead of stretching it to the box', () => {
    const box = fitImageBox(docWith(3000, 3000), 'x', 0, 0, 120, 30);
    expect(box.w).toBeCloseTo(30);
    expect(box.h).toBeCloseTo(30);
    expect(box.w / box.h).toBeCloseTo(1);
  });

  it('fits a wide logo to the box width', () => {
    // 2076×481 ≈ 4.31:1, which is wider than the 4:1 box.
    const box = fitImageBox(docWith(2076, 481), 'x', 0, 0, 120, 30);
    expect(box.w).toBeCloseTo(120);
    expect(box.h).toBeCloseTo(120 * (481 / 2076));
    expect(box.h).toBeLessThanOrEqual(30);
  });

  it('never exceeds the box in either dimension', () => {
    for (const [w, h] of [[3000, 3000], [2076, 481], [100, 4000], [4000, 100]]) {
      const box = fitImageBox(docWith(w, h), 'x', 0, 0, 120, 30);
      expect(box.w).toBeLessThanOrEqual(120 + 0.001);
      expect(box.h).toBeLessThanOrEqual(30 + 0.001);
    }
  });

  it('preserves the source ratio exactly', () => {
    const box = fitImageBox(docWith(1600, 900), 'x', 0, 0, 200, 200);
    expect(box.w / box.h).toBeCloseTo(1600 / 900, 5);
  });

  it('centres what it fits inside the box', () => {
    // A square in a wide box has spare width on both sides.
    const box = fitImageBox(docWith(500, 500), 'x', 40, 20, 120, 30);
    expect(box.h).toBeCloseTo(30);
    expect(box.x).toBeCloseTo(40 + (120 - 30) / 2);
    expect(box.y).toBeCloseTo(20);
  });

  it('aligns to the left edge of the box when asked', () => {
    // The gear list draws at the page margin, so slack has to fall on the right.
    const box = fitImageBox(docWith(500, 500), 'x', 40, 20, 120, 30, 'left');
    expect(box.x).toBeCloseTo(40);
  });

  it('aligns to the right edge of the box when asked', () => {
    // The call sheet logo is right-aligned against the page margin: the fitted
    // image has to end where the box ends, not where a centred one would.
    const box = fitImageBox(docWith(500, 500), 'x', 40, 20, 120, 30, 'right');
    expect(box.x + box.w).toBeCloseTo(40 + 120);
  });

  it('still centres vertically regardless of horizontal alignment', () => {
    const box = fitImageBox(docWith(4000, 100), 'x', 0, 20, 120, 30, 'left');
    expect(box.h).toBeCloseTo(3);
    expect(box.y).toBeCloseTo(20 + (30 - 3) / 2);
  });

  it('falls back to filling the box when the image cannot be read', () => {
    // Previous behaviour, kept: a wrong-looking logo beats a PDF that throws.
    const broken = { getImageProperties: () => { throw new Error('bad data'); } };
    expect(fitImageBox(broken, 'x', 5, 6, 120, 30)).toEqual({ w: 120, h: 30, x: 5, y: 6 });
    expect(fitImageBox({}, 'x', 5, 6, 120, 30)).toEqual({ w: 120, h: 30, x: 5, y: 6 });
  });

  it('ignores nonsense dimensions rather than dividing by zero', () => {
    const zero = { getImageProperties: () => ({ width: 0, height: 0 }) };
    expect(fitImageBox(zero, 'x', 0, 0, 120, 30)).toEqual({ w: 120, h: 30, x: 0, y: 0 });
  });
});
