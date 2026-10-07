import { EditorState, Transaction, type Extension, type TransactionSpec } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import type { SyntaxNode, Tree } from "@lezer/common";
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

/**
 * The whole of an emphasis whose content is exactly `from`..`to`, markers
 * included, or null when the range isn't that.
 *
 * Replacing an italic word with a line break left `*` and `*` behind with
 * nothing between them: the content went, and the markers, being invisible,
 * were never part of what the writer thought they had selected. Emphasis with
 * nothing inside it isn't emphasis, so the markers go with the words.
 */
export function emphasisEmptiedBy(
  tree: Tree,
  from: number,
  to: number,
): { from: number; to: number } | null {
  if (to <= from) return null;
  // From the node itself outwards: with nothing but text between the marks,
  // the position resolves to the emphasis rather than to anything inside it.
  for (let node: SyntaxNode | null = tree.resolveInner(from, 1); node; node = node.parent) {
    const first = node.firstChild;
    const last = node.lastChild;
    if (!first || !last || first === last) continue;
    if (!MARKS.has(first.name) || !MARKS.has(last.name)) continue;
    // The marks sit either side of exactly what is being replaced.
    if (first.to === from && last.from === to) return { from: node.from, to: node.to };
  }
  return null;
}

/**
 * True when the writer, not the app, made this change.
 *
 * Matched on the exact label rather than by family. Typing arrives as
 * "input.type" but Enter arrives as plain "input", and asking whether a
 * transaction is an "input.type" says no to Enter — which is how the line
 * break went on breaking emphasis after the space had been fixed. Asking the
 * family question instead would say yes to pasting and dropping, which are
 * their own decisions.
 */
function fromTheKeyboard(event: string | undefined): "typing" | "deleting" | null {
  if (event === "input" || event === "input.type") return "typing";
  if (event === "delete") return "deleting";
  return null;
}

export function keepEmphasisWhole(): Extension {
  return EditorState.transactionFilter.of((tr) => {
    if (!tr.docChanged) return tr;
    const kind = fromTheKeyboard(tr.annotation(Transaction.userEvent));
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
      // belongs to that word, and a letter typed over a whole italic word
      // replaces its contents and stays italic.
      if (!/^\s*$/.test(change.insert)) return tr;

      if (change.to !== change.from) {
        // Whitespace over a whole italic word. What is left would be a pair of
        // markers with nothing between them, so they go too.
        const emptied = emphasisEmptiedBy(tree, change.from, change.to);
        if (!emptied) return tr;
        return {
          changes: { ...emptied, insert: change.insert },
          selection: { anchor: emptied.from + change.insert.length },
          scrollIntoView: true,
          userEvent: "input.type",
        } satisfies TransactionSpec;
      }
      if (change.insert.length === 0) return tr;
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
    // First, don't let it eat a marker instead of a letter.
    const reach =
      deletionBelongsAt(
        hidden,
        change.from,
        change.to,
        tr.startState.doc.length,
        tr.startState.selection.main.head,
      ) ?? change;

    // Then, if what it takes is the last of the words between a pair of
    // markers, the markers go too. Otherwise deleting the only letter of a
    // one-word italic left `**` standing in the prose.
    const final = emphasisEmptiedBy(tree, reach.from, reach.to) ?? reach;

    if (final.from === change.from && final.to === change.to) return tr;
    return {
      changes: { from: final.from, to: final.to },
      selection: { anchor: final.from },
      scrollIntoView: true,
      userEvent: "delete",
    } satisfies TransactionSpec;
  });
}
