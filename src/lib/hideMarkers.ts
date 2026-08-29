import { Decoration, ViewPlugin, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";

/**
 * Hides Markdown's punctuation so prose looks like prose.
 *
 * `**bold**` renders as bold with the asterisks gone, `# Chapter` as a
 * heading with no hash. The characters are still in the file: this only
 * stops drawing them, so the document on disk is unchanged and a `.mari`
 * renamed to `.zip` still holds plain, ordinary Markdown.
 *
 * The markers come back the moment the cursor is inside that piece of text.
 * Without that they'd be unreachable: you could see bold but never find the
 * asterisks to delete, and backspacing at the edge of a hidden marker would
 * eat characters that aren't on screen.
 */

/** Syntax-tree nodes that are punctuation rather than prose. */
const MARKS = new Set([
  "EmphasisMark", // * and _ around italic and bold
  "StrikethroughMark", // ~~
  "HeaderMark", // # and the space after it
  "QuoteMark", // >
  "CodeMark", // `
  "LinkMark", // [ ] ( )
]);

export function isMarkerNode(name: string): boolean {
  return MARKS.has(name);
}

/**
 * True when any cursor or selection touches this stretch of the document.
 *
 * Deliberately inclusive at both ends: with the caret sitting immediately
 * after a hidden `**`, the writer is editing that word and needs to see what
 * they're editing.
 */
export function touchedBySelection(
  ranges: readonly { from: number; to: number }[],
  from: number,
  to: number,
): boolean {
  return ranges.some((r) => r.from <= to && r.to >= from);
}


/** How far the hidden run should reach, swallowing the space after `#` or `>`. */
export function markEnd(following: string, name: string, to: number): number {
  if (name !== "HeaderMark" && name !== "QuoteMark") return to;
  const spaces = following.match(/^ +/)?.[0].length ?? 0;
  return to + spaces;
}

function buildDecorations(state: EditorState, view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const ranges = state.selection.ranges;

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (!isMarkerNode(node.name)) return;
        // The whole construct, not just the marker: with the caret anywhere
        // in `**bold**` both pairs of asterisks should reappear together,
        // rather than only the one being touched.
        const parent = node.node.parent;
        const reach = parent ?? node.node;
        if (touchedBySelection(ranges, reach.from, reach.to)) return;

        // `#` and `>` are their own node, but the space after them isn't.
        // Leaving it draws every heading and quote one space indented.
        const end = markEnd(state.doc.sliceString(node.to, node.to + 4), node.name, node.to);
        if (end > node.from) builder.add(node.from, end, Decoration.replace({}));
      },
    });
  }
  return builder.finish();
}

/**
 * Markdown punctuation hidden until the cursor reaches it.
 *
 * Only worth applying to `.mari` documents. A `.md` file is Markdown that the
 * writer opened as Markdown, and hiding its syntax there would be presumptuous.
 */
export function hideMarkers(): Extension {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view.state, view);
      }

      update(update: { docChanged: boolean; selectionSet: boolean; viewportChanged: boolean; view: EditorView; state: EditorState }) {
        // Selection matters as much as the text: moving the caret into a word
        // is what brings its markers back.
        if (update.docChanged || update.selectionSet || update.viewportChanged) {
          this.decorations = buildDecorations(update.state, update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}
