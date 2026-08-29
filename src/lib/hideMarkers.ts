import { Decoration, ViewPlugin, EditorView, type DecorationSet } from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { EditorState, Extension } from "@codemirror/state";

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

/** A rule down the left of a quoted passage, the way a quote is usually set. */
const quoteLine = Decoration.line({ class: "cm-quoted" });

interface Built {
  /** Hidden punctuation. Also what the cursor treats as atomic. */
  markers: DecorationSet;
  /** Everything drawn, including the quote rule. */
  all: DecorationSet;
}

function buildDecorations(state: EditorState, view: EditorView): Built {
  const hidden: { from: number; to: number; value: Decoration }[] = [];
  const lines: { from: number; to: number; value: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter: (node) => {
        if (node.name === "Blockquote") {
          // Marked line by line: a quote can run over several lines, and the
          // rule has to reach down all of them.
          for (let pos = node.from; pos <= node.to; ) {
            const line = state.doc.lineAt(pos);
            lines.push({ from: line.from, to: line.from, value: quoteLine });
            if (line.to >= node.to) break;
            pos = line.to + 1;
          }
          return;
        }
        if (!isMarkerNode(node.name)) return;
        // `#` and `>` are their own node, but the space after them isn't.
        // Leaving it draws every heading and quote one space indented.
        const end = markEnd(state.doc.sliceString(node.to, node.to + 4), node.name, node.to);
        if (end > node.from) hidden.push({ from: node.from, to: end, value: Decoration.replace({}) });
      },
    });
  }

  // Sorted rather than built in order: line decorations and replacements are
  // discovered as the tree is walked, not left to right.
  return {
    markers: Decoration.set(hidden, true),
    all: Decoration.set([...hidden, ...lines], true),
  };
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
      built: Built;

      constructor(view: EditorView) {
        this.built = buildDecorations(view.state, view);
      }

      update(update: {
        docChanged: boolean;
        viewportChanged: boolean;
        view: EditorView;
        state: EditorState;
      }) {
        if (update.docChanged || update.viewportChanged) {
          this.built = buildDecorations(update.state, update.view);
        }
      }
    },
    { decorations: (v) => v.built.all },
  );

  return [
    plugin,
    // Makes each hidden marker a single obstacle to the cursor rather than a
    // run of invisible characters to walk through one at a time. Only the
    // markers: the quote rule is a whole line, and making lines atomic would
    // stop the cursor entering them at all.
    EditorView.atomicRanges.of((view) => view.plugin(plugin)?.built.markers ?? Decoration.none),
    EditorView.theme({
      ".cm-quoted": {
        borderLeft: "3px solid var(--color-border)",
        paddingLeft: "0.85em",
        marginLeft: "1px",
      },
    }),
  ];
}
