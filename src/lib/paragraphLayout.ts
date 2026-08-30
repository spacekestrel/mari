import { Decoration, ViewPlugin, EditorView, type DecorationSet } from "@codemirror/view";
import type { EditorState, Extension } from "@codemirror/state";

/**
 * Laying prose out the way a novel is typeset rather than the way a web page is.
 *
 * On a web page paragraphs are separated by a gap and start flush left. In a
 * book there is no gap: each paragraph after the first begins with an indent,
 * and that indent is what tells you a new one has started.
 *
 * Display only. The blank line between paragraphs is a real character in the
 * file; this draws it closed up rather than removing it, so the manuscript on
 * disk is untouched and a `.mari` renamed to `.zip` reads the same as ever.
 */

export type LineRole = "gap" | "indent" | "flush";

/**
 * Lines that already announce themselves as something new. A heading, a quote
 * or a list item is not a paragraph of prose and should sit flush.
 */
const OWN_BLOCK = /^\s*(#{1,6} |> |[-*+] |\d+[.)] )/;

const HEADING = /^\s*#{1,6} /;

/**
 * What to do with one line, given the last non-blank line above it.
 *
 * The first paragraph of a chapter, and the first after any heading, is set
 * flush left. Books do this consistently and an indent there is the usual
 * sign that something was never properly typeset.
 */
export function lineRole(line: string, previousNonBlank: string | null): LineRole {
  if (!line.trim()) return "gap";
  if (OWN_BLOCK.test(line)) return "flush";
  if (previousNonBlank === null) return "flush";
  if (HEADING.test(previousNonBlank)) return "flush";
  return "indent";
}

const GAP = Decoration.line({ class: "cm-para-gap" });
const INDENT = Decoration.line({ class: "cm-para-indent" });

function build(state: EditorState, view: EditorView): DecorationSet {
  const marks: { from: number; to: number; value: Decoration }[] = [];

  for (const { from, to } of view.visibleRanges) {
    let line = state.doc.lineAt(from);
    // The role depends on what came before, which may be off-screen, so walk
    // back to the nearest non-blank line rather than assuming.
    let previous: string | null = null;
    for (let n = line.number - 1; n >= 1; n--) {
      const above = state.doc.line(n);
      if (above.text.trim()) {
        previous = above.text;
        break;
      }
    }

    while (line.from <= to) {
      const role = lineRole(line.text, previous);
      if (role === "gap") marks.push({ from: line.from, to: line.from, value: GAP });
      else if (role === "indent") marks.push({ from: line.from, to: line.from, value: INDENT });

      if (line.text.trim()) previous = line.text;
      if (line.number >= state.doc.lines) break;
      line = state.doc.line(line.number + 1);
    }
  }
  return Decoration.set(marks, true);
}

/**
 * Book-style paragraphs: closed up, and indented after the first.
 *
 * Not installed at all in block style, so the ordinary layout costs nothing.
 */
export function bookParagraphs(): Extension {
  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = build(view.state, view);
        }

        update(update: {
          docChanged: boolean;
          viewportChanged: boolean;
          view: EditorView;
          state: EditorState;
        }) {
          if (update.docChanged || update.viewportChanged) {
            this.decorations = build(update.state, update.view);
          }
        }
      },
      { decorations: (v) => v.decorations },
    ),
    EditorView.theme({
      // Collapsed rather than removed: the line is still there to put a cursor
      // on, so pressing Enter and arrowing about behave as they always did.
      ".cm-para-gap": {
        lineHeight: "0.35",
      },
      ".cm-para-indent": {
        textIndent: "1.6em",
      },
    }),
  ];
}
