import { EditorView } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import type { Tree } from "@lezer/common";

/**
 * Keeping a typed space out of the middle of emphasis.
 *
 * Markdown will not read `*brown *` as italic: a closing marker cannot have a
 * space in front of it. So the moment a writer finished an italic word and
 * pressed the spacebar, the emphasis stopped being emphasis and its asterisks,
 * until then hidden, appeared in the middle of the prose. Since the markers
 * are invisible there is no way to see why, or where the caret actually was.
 *
 * The caret sits inside the markers because that is where formatting the
 * selection leaves it, and because clicking at the end of an italic word lands
 * there too. Rather than fight either, a space typed against a marker is put
 * on the outside of it, which is where the writer meant it to go.
 *
 * Only for documents whose markers are hidden. In a plain `.md` file the
 * writer can see the asterisks and means what they type.
 */

/** Markdown punctuation that a space must not be typed against. */
const MARKS = new Set(["EmphasisMark", "StrikethroughMark"]);

/**
 * Where a space typed at `pos` should actually go, or null to leave it alone.
 *
 * Walks outwards rather than stepping once, because emphasis nests: the caret
 * at the end of `***brown***` has two closing markers in front of it, and
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
 * The same rule, as an editor extension.
 *
 * Handles the keystroke rather than correcting afterwards, so the document
 * never passes through a broken state and one undo takes back one space.
 */
export function spaceOutsideEmphasis(): Extension {
  return EditorView.inputHandler.of((view, from, to, text) => {
    // Only a plain caret typing whitespace. A selection being replaced is the
    // writer saying to put this here, and pasting is not typing.
    if (from !== to) return false;
    if (!/^[ \t]+$/.test(text)) return false;

    const target = spaceBelongsAt(syntaxTree(view.state), from);
    if (target === null) return false;

    view.dispatch({
      changes: { from: target, insert: text },
      selection: { anchor: target + text.length },
      userEvent: "input.type",
    });
    return true;
  });
}
