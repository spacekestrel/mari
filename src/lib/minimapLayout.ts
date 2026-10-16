/**
 * The arithmetic behind the minimap: how a line of prose is broken into rows
 * in the little preview, and where the viewport box sits on it.
 *
 * Kept apart from the drawing because this is where the early minimap bugs
 * were — rows not filling the width, an uneven right-hand edge — and because
 * arithmetic can be checked without a canvas.
 */

/** Restates an `rgb()`/`rgba()` colour at a different opacity. */
export function withAlpha(rgba: string, alpha: number): string {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match) return rgba;
  const [r, g, b] = match[1].split(",").map((part) => part.trim());
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

export interface MinimapRow {
  from: number;
  to: number;
}

/**
 * Breaks one logical line into the rows it occupies in the preview, wrapping
 * on whole words the way the editor does.
 *
 * Character width is an estimate sampled from the document rather than
 * measured per token: measuring each one meant tens of thousands of text
 * measurements per redraw on a chapter-length document.
 */
export function wrapLineIntoRows(text: string, maxWidth: number, avgCharWidth: number): MinimapRow[] {
  // An empty line still occupies a row — otherwise the paragraph breaks
  // collapse and the preview stops lining up with the document.
  if (text.length === 0) return [{ from: 0, to: 0 }];

  const maxChars = Math.max(1, Math.floor(maxWidth / avgCharWidth));
  if (text.length <= maxChars) return [{ from: 0, to: text.length }];

  const rows: MinimapRow[] = [];
  const tokenRe = /\s*\S+/g;
  let rowStart = 0;
  let rowChars = 0;
  let lastEnd = 0;
  let match: RegExpExecArray | null;

  while ((match = tokenRe.exec(text))) {
    const token = match[0];
    const tokenEnd = match.index + token.length;
    // A word that won't fit starts the next row, taking its leading space
    // with it — that space is what kept rows short of the right edge.
    if (rowChars > 0 && rowChars + token.length > maxChars) {
      rows.push({ from: rowStart, to: lastEnd });
      rowStart = lastEnd;
      rowChars = 0;
    }
    rowChars += token.length;
    lastEnd = tokenEnd;
  }

  // Trailing whitespace after the last word belongs to the final row.
  if (rowStart < text.length) rows.push({ from: rowStart, to: text.length });
  return rows;
}

/**
 * On a novel the viewport is a fraction of a percent of the document, so its
 * true proportional height rounds to a single invisible pixel. Keep a floor on
 * it so there is always something to see and aim at.
 */
export const MIN_INDICATOR_PX = 10;

/** Where the viewport box sits on the minimap, and how tall it is. */
export function viewportIndicator(
  scrollTop: number,
  scrollHeight: number,
  clientHeight: number,
  canvasHeight: number,
): { top: number; height: number } {
  if (scrollHeight <= 0 || canvasHeight <= 0) return { top: 0, height: 0 };

  const heightFraction = clientHeight / scrollHeight;
  const height = Math.max(MIN_INDICATOR_PX, Math.min(canvasHeight, heightFraction * canvasHeight));

  // Clamped so the floored height can't push the box past the bottom.
  const topFraction = scrollTop / scrollHeight;
  const top = Math.max(0, Math.min(topFraction * canvasHeight, canvasHeight - height));

  return { top, height };
}
