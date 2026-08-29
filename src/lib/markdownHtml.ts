import { marked } from "marked";
import DOMPurify from "dompurify";

/**
 * Markdown to HTML, in one place.
 *
 * Two things need this and they must agree: the reading view, and the
 * formatted copy that goes on the clipboard. What someone sees in the reading
 * view should be what they get when they paste the same passage into Word.
 */

/**
 * The conversion on its own, without sanitising.
 *
 * Split out because DOMPurify needs a real document to work against, so this
 * half can be tested without a browser.
 */
export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  return (marked.parse(markdown, { async: false }) as string).trim();
}

/** The same, with anything executable stripped. Use this to display or copy. */
export function renderMarkdown(markdown: string): string {
  const html = markdownToHtml(markdown);
  return html ? DOMPurify.sanitize(html).trim() : "";
}
