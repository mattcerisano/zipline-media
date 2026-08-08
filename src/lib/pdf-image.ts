/**
 * Fitting images into PDF boxes without distorting them.
 *
 * jsPDF's addImage(data, fmt, x, y, w, h) stretches to exactly the width and
 * height given — it does not preserve the source ratio. Every PDF header here
 * passed a hardcoded box, so the studio logo was squashed to whatever shape the
 * box happened to be. The branding logo is uploaded by the org, so its ratio
 * isn't knowable when the box is written: the only correct approach is to read
 * the image and fit it.
 */

export interface Box { w: number; h: number; x: number; y: number }

/** Where the fitted image sits when it is narrower than the box it was given. */
export type FitAlign = 'left' | 'center' | 'right';

/**
 * The largest rectangle with the image's own proportions that fits inside
 * `maxW` × `maxH`, aligned horizontally by `align` and centred vertically.
 *
 * Never returns anything larger than the box it was given, so a caller's
 * surrounding layout can't be pushed around by an unusually shaped logo.
 *
 * Alignment matters because these boxes sit against a page margin. A square
 * logo in a 120pt-wide box has 90pt of slack; centred, it floats away from the
 * margin that every other element on the page lines up against.
 *
 * `doc` is typed loosely because jsPDF's own types don't expose
 * getImageProperties on the instance in every version.
 */
export function fitImageBox(
  doc: { getImageProperties?: (data: string) => { width: number; height: number } },
  data: string,
  boxX: number,
  boxY: number,
  maxW: number,
  maxH: number,
  align: FitAlign = 'center',
): Box {
  let ratio = 0;
  try {
    const props = doc.getImageProperties?.(data);
    if (props && props.width > 0 && props.height > 0) ratio = props.width / props.height;
  } catch {
    // Unreadable image: fall through to filling the box, which is the
    // behaviour that existed before this function. A wrong-looking logo beats
    // a PDF that fails to generate.
  }
  if (!ratio) return { w: maxW, h: maxH, x: boxX, y: boxY };

  // Fit to width first, then fall back to height when that would overflow —
  // the case that matters, since a square logo in a wide box is what produced
  // the squashing.
  let w = maxW;
  let h = maxW / ratio;
  if (h > maxH) {
    h = maxH;
    w = maxH * ratio;
  }

  const slack = maxW - w;
  const dx = align === 'left' ? 0 : align === 'right' ? slack : slack / 2;

  return {
    w,
    h,
    x: boxX + dx,
    y: boxY + (maxH - h) / 2,
  };
}
