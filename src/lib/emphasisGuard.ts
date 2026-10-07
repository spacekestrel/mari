import { EditorState, type Extension, type TransactionSpec } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { Tree } from "@lezer/common";
import { isHidden, markEnd } from "./hideMarkers";

/**
 * Keeping emphasis in one piece while it is being typed around.
 *
 * A `.mari` chapter stores italic as Markdown, `*word*`, and the editor hides
 * the markers. They are still characters, so the caret can stand between the
 * last letter of a word and its closing marker, in a place the writer cannot
 * see and did not aim for. Anything landing there breaks the pair, and the
 * markers that were invisible appear in the prose.
 *
 * Every change to the document passes through one filter here rather than a
 * patch per key. A space typed against a marker goes outside it; so does a
 * line break, which arrives by a different route and would otherwise split the
 * emphasis across two lines, where Markdown will not keep it. A deletion that
 * would swallow only markers takes the letter the writer could actually see
 * instead. Letters typed against a marker stay where they were typed, because
 * finishing an italic word has to keep working.
 *
 * Only the writer's own typing and deleting. Mari's own edits — the formatting
 * buttons, replacing a passage from the draft panel, putting one back from the
 * drawer, loading another chapter — are left exactly as they were written.
 */

/** Markdown punctuation a space must not be typed against. */
const MARKS = new Set(["EmphasisMark", "StrikethroughMark"]);

/**
 * Where a space or line break typed at `pos` should actually go, or null to
 * leave it where it is.
 *
 * Walks outwards rather than stepping once, because emphasis nests: the caret
 * at the end of `***both***` has two closing markers in front of it, and
 * stopping after the first would still leave the space inside the italic.
 */
export function spaceBelongsAt(tree: Tree, pos: number): number | null {
  // In front of the caret: markers that close emphasis the caret is inside.
  let at = pos;
  for (;;) {
    const node = tree.resolveInner(at, 1);
    // A mark that starts here and finishes where its emphasis finishes is the
    // closing one. The opening mark of an adjacent word starts here too, and
    // must not be jumped over — that would move the space into the next word.
    if (!MARKS.has(node.name) || node.from !== at) break;
    if (node.parent?.to !== node.to) break;
    at = node.to;
  }
  if (at !== pos) return at;

  // Behind the caret: the same problem mirrored. `* brown*` is not italic
  // either, so a space typed just inside an opening marker goes before it.
  at = pos;
  for (;;) {
    const node = tree.resolveInner(at, -1);
    if (!MARKS.has(node.name) || node.to !== at) break;
    if (node.parent?.from !== node.from) break;
    at = node.from;
  }
  return at !== pos ? at : null;
}

/**
 * Every character the editor paints over, as a test on one position.
 *
 * Built from the same rules that hide them, so the two can't disagree about
 * what is invisible.
 */
export function hiddenCharacters(tree: Tree, doc: { sliceString(from: number, to: number): string }) {
  const runs: { from: number; to: number }[] = [];
  tree.iterate({
    enter: (node) => {
      if (!isHidden(node.name, node.node.parent?.name ?? null)) return;
      const end = markEnd(doc.sliceString(node.to, node.to + 4), node.name, node.to);
      if (end > node.from) runs.push({ from: node.from, to: end });
    },
  });
  return (pos: number) => runs.some((r) => pos >= r.from && pos < r.to);
}

/**
 * Where a deletion should actually reach, or null to leave it alone.
 *
 * A writer pressing backspace at the end of an italic word is looking at the
 * last letter, not at the marker standing invisibly after it. Deleting the
 * marker alone would orphan its partner and reveal both. So a deletion made
 * entirely of hidden characters is moved onto the nearest character the writer
 * can see, and the markers it would have eaten are left alone.
 */
export function deletionBelongsAt(
  hidden: (pos: number) => boolean,
  from: number,
  to: number,
  docLength: number,
  /** Where the caret was before the key was pressed, which says which way it went. */
  caretBefore: number,
): { from: number; to: number } | null {
  if (to <= from) return null;
  for (let i = from; i < to; i++) if (!hidden(i)) return null; // touches real text

  // Backspace leaves the caret at the end of what it took, forward delete at
  // the start. Nothing else says which direction a deletion went.
  if (caretBefore === to) {
    let at = from;
    while (at > 0 && hidden(at - 1)) at--;
    return at > 0 ? { from: at - 1, to: at } : null;
  }
  if (caretBefore === from) {
    let at = to;
    while (at < docLength && hidden(at)) at++;
    return at < docLength ? { from: at, to: at + 1 } : null;
  }
  return null;
}

/** True when the writer, not the app, made this change. */
function fromTheKeyboard(isUserEvent: (type: string) => boolean): "typing" | "deleting" | null {
  if (isUserEvent("input.type")) return "typing";
  if (isUserEvent("delete")) return "deleting";
  return null;
}

export function keepEmphasisWhole(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    const kind = fromTheKeyboard((type) => tr.isUserEvent(type));
    if (!kind) return tr;

    // One change at a time. A multi-cursor edit or a bulk replacement is not
    // somebody typing a space at the end of a word.
    let only: { from: number; to: number; insert: string } | null = null;
    let count = 0;
    tr.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
      count++;
      only = { from: fromA, to: toA, insert: inserted.toString() };
    });
    if (count !== 1 || !only) return tr;
    const change: { from: number; to: number; insert: string } = only;

    const tree = syntaxTree(tr.startState);

    if (kind === "typing") {
      // Only whitespace moves. A letter typed at the end of an italic word
      // belongs to that word.
      if (change.to !== change.from) return tr;
      if (!/^\s+$/.test(change.insert)) return tr;
      const target = spaceBelongsAt(tree, change.from);
      if (target === null || target === change.from) return tr;
      return {
        changes: { from: target, insert: change.insert },
        selection: { anchor: target + change.insert.length },
        scrollIntoView: true,
        // Still typing as far as undo is concerned, so one undo takes back one
        // space rather than the whole sentence around it.
        userEvent: "input.type",
      } satisfies TransactionSpec;
    }

    if (change.insert.length > 0) return tr; // a replacement, not a deletion
    const hidden = hiddenCharacters(tree, tr.startState.doc);
    const moved = deletionBelongsAt(
      hidden,
      change.from,
      change.to,
      tr.startState.doc.length,
      tr.startState.selection.main.head,
    );
    if (!moved) return tr;
    return {
      changes: moved,
      selection: { anchor: moved.from },
      scrollIntoView: true,
      userEvent: "delete",
    } satisfies TransactionSpec;
  });
}
