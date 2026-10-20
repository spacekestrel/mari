/**
 * Undo and redo inside the drafting box.
 *
 * The box is a plain textarea, and a textarea has undo of its own, but not
 * one that can be relied on here. Going to Compare and back to Keep tweaking
 * takes the box off screen and builds a new one, and the browser's undo trail
 * goes with it: the writer presses Ctrl+Z after coming back and nothing
 * happens, or the whole draft vanishes at once. WebKitGTK, which is what the
 * app runs on, is unreliable about redo in a textarea even without that.
 *
 * So the trail is kept here instead, beside the draft rather than inside the
 * box, and it survives the box being rebuilt. It is deliberately plain data,
 * with no DOM and no editor, so the grouping rules below can be tested.
 */

/** The draft box at one moment: what was in it, and where the caret stood. */
export interface DraftSnapshot {
  text: string;
  /** Selection, which is the caret when both ends are the same. */
  from: number;
  to: number;
}

/** Typing, deleting, or something that did both at once: a paste over a selection. */
export type DraftEditKind = "insert" | "delete" | "other";

/** How the present snapshot came about, so the next keystroke knows whether to join it. */
interface DraftEditMark {
  kind: DraftEditKind;
  /** When it happened, in milliseconds. */
  at: number;
  /** True when the edit finished a word, which closes the step. */
  endedWord: boolean;
}

export interface DraftHistory {
  /** Earlier steps, oldest first. The last one is where a single undo lands. */
  past: DraftSnapshot[];
  /** What is in the box now. */
  present: DraftSnapshot;
  /** Steps that have been undone, nearest first, waiting to be redone. */
  future: DraftSnapshot[];
  /** Null when the present can't be joined: after an undo, or at the start. */
  lastEdit: DraftEditMark | null;
}

/**
 * How long a pause ends a step. Short enough that stopping to think leaves a
 * mark you can undo back to, long enough that ordinary typing doesn't become
 * one step per letter.
 */
export const DRAFT_GROUP_DELAY_MS = 600;

/**
 * A ceiling on how far back the trail goes, so a long session in the box
 * can't grow without limit. Far more steps than anyone walks back through.
 */
export const DRAFT_MAX_STEPS = 200;

export function createDraftHistory(snapshot: DraftSnapshot): DraftHistory {
  return { past: [], present: snapshot, future: [], lastEdit: null };
}

/**
 * What changed between two versions of the text: the run that differs, and
 * whether it was put in or taken out.
 *
 * Found by matching from both ends, which is all the information a textarea
 * gives us: it reports the text after the change, not the change itself.
 */
function describeEdit(before: string, after: string): { kind: DraftEditKind; text: string } {
  let start = 0;
  const shortest = Math.min(before.length, after.length);
  while (start < shortest && before[start] === after[start]) start += 1;

  let end = 0;
  while (end < shortest - start && before[before.length - 1 - end] === after[after.length - 1 - end]) {
    end += 1;
  }

  const removed = before.slice(start, before.length - end);
  const added = after.slice(start, after.length - end);

  if (!removed) return { kind: "insert", text: added };
  if (!added) return { kind: "delete", text: removed };
  return { kind: "other", text: added };
}

/**
 * Whether this edit belongs to the step already in progress.
 *
 * Typing a word is one step, not one step per letter. Walking back through a
 * sentence a character at a time is nobody's idea of undo. A step ends at a
 * pause, at a space, when typing turns into deleting, and when more than one
 * character arrives at once, because that didn't come from the keyboard: a
 * paste or a drag is its own step whatever else was happening.
 */
function joinsCurrentStep(last: DraftEditMark | null, kind: DraftEditKind, text: string, now: number): boolean {
  if (!last) return false;
  if (kind === "other" || last.kind !== kind) return false;
  if ([...text].length !== 1) return false;
  if (last.endedWord) return false;
  return now - last.at <= DRAFT_GROUP_DELAY_MS;
}

/**
 * Takes in what the box now holds and returns the trail with it added.
 *
 * Called on every change to the box. Anything already undone is dropped: the
 * writer has carried on from here, so the branch they left is gone.
 */
export function recordDraftEdit(history: DraftHistory, next: DraftSnapshot, now: number): DraftHistory {
  // The caret moved and nothing else. Worth keeping, because an undo lands
  // the caret where it last was, but it isn't a step.
  if (next.text === history.present.text) {
    return { ...history, present: next };
  }

  const { kind, text } = describeEdit(history.present.text, next.text);
  const mark: DraftEditMark = { kind, at: now, endedWord: /\s/.test(text) };

  if (joinsCurrentStep(history.lastEdit, kind, text, now)) {
    return { past: history.past, present: next, future: [], lastEdit: mark };
  }

  const past = [...history.past, history.present];
  return {
    past: past.length > DRAFT_MAX_STEPS ? past.slice(past.length - DRAFT_MAX_STEPS) : past,
    present: next,
    future: [],
    lastEdit: mark,
  };
}

/** One step back, or null when there is nothing behind the present. */
export function undoDraft(history: DraftHistory): DraftHistory | null {
  if (history.past.length === 0) return null;
  return {
    past: history.past.slice(0, -1),
    present: history.past[history.past.length - 1],
    future: [history.present, ...history.future],
    // Whatever is typed next starts a fresh step rather than joining the one
    // that was just stepped out of.
    lastEdit: null,
  };
}

/** One step forward again, or null when nothing has been undone. */
export function redoDraft(history: DraftHistory): DraftHistory | null {
  if (history.future.length === 0) return null;
  return {
    past: [...history.past, history.present],
    present: history.future[0],
    future: history.future.slice(1),
    lastEdit: null,
  };
}

export function canUndoDraft(history: DraftHistory): boolean {
  return history.past.length > 0;
}

export function canRedoDraft(history: DraftHistory): boolean {
  return history.future.length > 0;
}
