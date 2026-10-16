/**
 * What a highlight action should cover.
 *
 * Two ways in, one rule. `Alt+1`..`Alt+8` act on the selection, or on the
 * paragraph the cursor is in when there is none — demanding a selection first
 * throws away most of the speed the shortcuts are for. Right-clicking follows
 * the same rule, against the paragraph under the pointer.
 *
 * That second case is what lets the menu open at all on macOS. Right-clicking
 * a word there selects it for you, but the editor hasn't been told yet when it
 * has to decide whether to show its own menu — so it saw no selection, stood
 * down, and the system's Look Up / Translate / Search menu came up over the
 * writer's novel instead.
 */

export interface Span {
  from: number;
  to: number;
}

export interface Line extends Span {
  text: string;
}

/**
 * The span to act on, or null when there is nothing worth acting on.
 *
 * A blank line gives null rather than an empty highlight: there is no text to
 * colour, and a zero-width mark is invisible and unreachable afterwards.
 */
export function highlightTarget(selection: Span, line: Line | null): Span | null {
  if (selection.to > selection.from) return { from: selection.from, to: selection.to };
  if (!line || !line.text.trim()) return null;
  return { from: line.from, to: line.to };
}
