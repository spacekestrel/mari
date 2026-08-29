import { marked } from "marked";
import DOMPurify from "dompurify";
import { EditorView } from "@codemirror/view";
import type { Extension } from "@codemirror/state";

/**
 * Puts formatted text on the clipboard as well as the Markdown.
 *
 * A clipboard holds several versions of the same thing at once and each app
 * takes the one it understands. Mari writes two: the Markdown exactly as it
 * sits in the file, and an HTML rendering of it.
 *
 * So pasting into Word, Google Docs, an email or a web page gives real bold
 * and real headings, while pasting into Mari, a code editor or anything
 * expecting plain text still gives `**bold**` and nothing is invented.
 *
 * Without this, copying out of a `.mari` chapter pasted asterisks into Word,
 * which is a strange thing to hand someone when the editor is showing you
 * formatted prose.
 */

/**
 * Markdown to HTML. Separate from the sanitising below so it can be tested
 * without a browser: DOMPurify needs a real document to work against.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  return (marked.parse(markdown, { async: false }) as string).trim();
}

/** What actually goes on the clipboard, with anything executable removed. */
export function renderForClipboard(markdown: string): string {
  const html = markdownToHtml(markdown);
  return html ? DOMPurify.sanitize(html).trim() : "";
}

/** The Markdown currently selected, ranges joined the way the editor joins them. */
function selectedMarkdown(view: EditorView): string {
  return view.state.selection.ranges
    .filter((r) => !r.empty)
    .map((r) => view.state.sliceDoc(r.from, r.to))
    .join(view.state.lineBreak);
}

function writeBothFlavours(event: ClipboardEvent, view: EditorView): boolean {
  const markdown = selectedMarkdown(view);
  if (!markdown || !event.clipboardData) return false;

  const html = renderForClipboard(markdown);
  if (!html) return false;

  // Only now: up to this point the default copy would still have been correct,
  // and preventing it without writing anything empties the clipboard.
  event.preventDefault();
  event.clipboardData.setData("text/plain", markdown);
  event.clipboardData.setData("text/html", html);
  return true;
}

export function richCopy(): Extension {
  return EditorView.domEventHandlers({
    copy: (event, view) => writeBothFlavours(event, view),
    cut: (event, view) => {
      if (!writeBothFlavours(event, view)) return false;
      // preventDefault above stops the browser removing the text, so the cut
      // has to be made here or it would behave as a copy.
      view.dispatch(view.state.replaceSelection(""));
      return true;
    },
  });
}
