import type { MariCut } from "./mariBundle";

/**
 * The decisions behind cutting a passage into the chapter's drawer, and
 * putting one back. Kept out of the editor component so they can be tested:
 * a passage in the drawer exists nowhere else, so getting these wrong loses
 * writing outright.
 */

/** How much prose either side of a cut is remembered, for aiming Put back. */
export const CUT_CONTEXT_CHARS = 60;

export function newCutId(): string {
  return `cut-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Describes a passage about to leave the chapter, including the prose either
 * side of it so it can be put back where it came from. Returns null when the
 * selection holds nothing worth keeping — cutting a blank line shouldn't fill
 * the drawer with empties.
 */
export function describeCut(
  doc: string,
  from: number,
  to: number,
  stamp: { id?: string; cutAt?: string } = {},
): MariCut | null {
  const start = Math.max(0, Math.min(from, to));
  const end = Math.min(doc.length, Math.max(from, to));
  const text = doc.slice(start, end);
  if (!text.trim()) return null;

  return {
    id: stamp.id ?? newCutId(),
    text,
    cutAt: stamp.cutAt ?? new Date().toISOString(),
    before: doc.slice(Math.max(0, start - CUT_CONTEXT_CHARS), start),
    after: doc.slice(end, Math.min(doc.length, end + CUT_CONTEXT_CHARS)),
  };
}

/** The one place a string occurs, or -1 if it's absent or appears more than once. */
function onlyOccurrence(doc: string, needle: string | undefined): number {
  if (!needle) return -1;
  const first = doc.indexOf(needle);
  if (first < 0) return -1;
  return doc.indexOf(needle, first + 1) === -1 ? first : -1;
}

/**
 * Where a cut passage goes back. The remembered context is only trusted when
 * it appears exactly once — otherwise there's no telling which copy is the
 * right one, and dropping it at the cursor is honest about that rather than
 * quietly putting it in the wrong chapter position.
 */
export function findPutBackPosition(doc: string, cut: MariCut, cursor: number): number {
  const beforeAt = onlyOccurrence(doc, cut.before);
  if (beforeAt >= 0) return beforeAt + (cut.before?.length ?? 0);

  const afterAt = onlyOccurrence(doc, cut.after);
  if (afterAt >= 0) return afterAt;

  // Never off the end of the document, however stale the cursor is.
  return Math.max(0, Math.min(cursor, doc.length));
}
