import { Decoration, ViewPlugin, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import { RangeSetBuilder, type EditorState, type Extension } from "@codemirror/state";

/**
 * Hides Markdown's punctuation so prose reads as prose.
 *
 * `**bold**` is drawn bold with no asterisks, `# Chapter` as a heading with
 * no hash. The characters stay in the file untouched: this only stops them
 * being drawn, so a `.mari` renamed to `.zip` still holds plain Markdown.
 *
 * The markers are hidden all the time, never revealed. That means the cursor
 * must not be able to get inside them, which is what the atomic ranges below
 * are for: arrow keys step over a hidden `**` in one go, and backspace takes
 * the whole marker rather than eating one invisible character at a time.
 * Formatting is added and removed through the bar over the selection, not by
 * typing the punctuation by hand.
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

/** How far the hidden run should reach, swallowing the space after `#` or `>`. */
export function markEnd(following: string, name: string, to: number): number {
  if (name !== "HeaderMark" && name !== "QuoteMark") return to;
  const spaces = following.match(/^ +/)?.[0].length ?? 0;
  return to + spaces;
}

function buildDecorations(state: EditorState, view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (!isMarkerNode(node.name)) return;
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
 * Markdown punctuation, hidden.
 *
 * Only worth applying to `.mari` documents. A `.md` file is Markdown that the
 * writer opened as Markdown, and hiding its syntax there would be presumptuous.
 */
export function hideMarkers(): Extension {
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;

      constructor(view: EditorView) {
        this.decorations = buildDecorations(view.state, view);
      }

      update(update: {
        docChanged: boolean;
        viewportChanged: boolean;
        view: EditorView;
        state: EditorState;
      }) {
        if (update.docChanged || update.viewportChanged) {
          this.decorations = buildDecorations(update.state, update.view);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );

  return [
    plugin,
    // Makes each hidden marker a single obstacle to the cursor rather than a
    // run of invisible characters to walk through one at a time.
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.decorations ?? Decoration.none),
  ];
}
