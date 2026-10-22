import { renderMarkdown } from "./markdownHtml";
import { copyText } from "./clipboard";
import { htmlToMarkdown } from "./htmlToMarkdown";
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

  const html = renderMarkdown(markdown);
  if (!html) return false;

  // Only now: up to this point the default copy would still have been correct,
  // and preventing it without writing anything empties the clipboard.
  event.preventDefault();
  event.clipboardData.setData("text/plain", markdown);
  event.clipboardData.setData("text/html", html);
  return true;
}

/**
 * Takes the formatted version of what was pasted, when there is one.
 *
 * Word, Google Docs and web pages all put HTML on the clipboard next to the
 * plain text. Letting the default paste happen takes the plain version and
 * throws the formatting away, so a bold sentence from Word arrives flat.
 */
function pasteAsMarkdown(event: ClipboardEvent, view: EditorView): boolean {
  const html = event.clipboardData?.getData("text/html");
  if (!html) return false;

  const markdown = htmlToMarkdown(html);
  if (!markdown) return false;

  // Text copied from Mari itself already carries its Markdown in the plain
  // flavour. Converting our own HTML back would work, but going through the
  // original is exact, so prefer it when the two agree on the words.
  const plain = event.clipboardData?.getData("text/plain") ?? "";
  const sameWords = (a: string) => a.replace(/[^\p{L}\p{N}]+/gu, "").toLowerCase();
  const insert = plain && sameWords(plain) === sameWords(markdown) ? plain : markdown;

  event.preventDefault();
  view.dispatch(view.state.replaceSelection(insert));
  return true;
}

/**
 * Puts a passage on the clipboard in both flavours, for the copy buttons.
 *
 * The editor's own Ctrl+C goes through the handlers above, which can write
 * straight into the copy event. A button has no event to write into, so it has
 * to ask the clipboard directly — and the plain-text call every button used
 * before wrote only the Markdown. Pasting a chapter into anywhere that shows
 * formatted text put literal asterisks on the page.
 */
export async function copyRichText(markdown: string): Promise<void> {
  const html = renderMarkdown(markdown);
  if (!html) {
    await copyText(markdown);
    return;
  }

  try {
    if (navigator.clipboard?.write && typeof ClipboardItem !== "undefined") {
      await navigator.clipboard.write([
        new ClipboardItem({
          "text/plain": new Blob([markdown], { type: "text/plain" }),
          "text/html": new Blob([html], { type: "text/html" }),
        }),
      ]);
      return;
    }
  } catch {
    // Falls through. WebKitGTK, which is what the app runs on, refuses this
    // call outside a few narrow conditions — the same reason copyText has a
    // fallback of its own.
  }

  await copyBothViaEvent(markdown, html);
}

/**
 * The old way, which still carries both flavours.
 *
 * A copy event is the one place both can be set without asking permission, so
 * one is provoked: an off-screen box is selected to give the command something
 * to act on, and the event it fires is answered with the real pair. The box's
 * own contents never reach the clipboard.
 */
function copyBothViaEvent(markdown: string, html: string): Promise<void> {
  return new Promise((resolve) => {
    const onCopy = (event: ClipboardEvent) => {
      event.clipboardData?.setData("text/plain", markdown);
      event.clipboardData?.setData("text/html", html);
      event.preventDefault();
    };

    const scratch = document.createElement("textarea");
    scratch.value = markdown;
    scratch.style.position = "fixed";
    scratch.style.top = "-9999px";
    scratch.style.opacity = "0";
    scratch.setAttribute("readonly", "");
    document.body.appendChild(scratch);
    scratch.select();

    document.addEventListener("copy", onCopy, true);
    try {
      document.execCommand("copy");
    } finally {
      document.removeEventListener("copy", onCopy, true);
      scratch.remove();
      resolve();
    }
  });
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
    paste: (event, view) => pasteAsMarkdown(event, view),
  });
}
