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
 * Everything Markdown can produce, and nothing else.
 *
 * Built by running the parser over a document using every piece of Markdown
 * syntax and collecting what came out, rather than from memory.
 *
 * The cleaner's own default list is far wider: drawings, maths notation,
 * embedded panels, most of what a web page can contain. Mari's prose needs
 * none of that, and the flaws found in sanitisers over the years have lived
 * almost entirely in those corners. Anything absent here is dropped without
 * being examined, so a whole family of problems has nothing to act on.
 *
 * Raw HTML someone typed into a chapter is dropped for the same reason. Its
 * words survive; only the markup goes.
 */
const ALLOWED_TAGS = [
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "em",
  "del",
  "code",
  "pre",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
];

/** `class` carries the code language; the rest belong to links and images. */
const ALLOWED_ATTR = ["href", "title", "alt", "src", "class"];

/**
 * Addresses a link or image may point at.
 *
 * `javascript:` is the obvious one to keep out, but this is a list of what is
 * allowed rather than a list of what is banned, so schemes nobody has thought
 * of yet are refused too.
 */
const ALLOWED_URI = /^(?:https?|mailto|tel|asset):|^[^a-z]|^\/|^\.\.?\//i;

export function markdownToHtml(markdown: string): string {
  if (!markdown.trim()) return "";
  return (marked.parse(markdown, { async: false }) as string).trim();
}

/** The same, cleaned. Use this to display or to copy. */
export function renderMarkdown(markdown: string): string {
  const html = markdownToHtml(markdown);
  if (!html) return "";

  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: ALLOWED_URI,
    // Both default to allowed. Neither can execute anything, but they are
    // surface this app has no use for.
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    // A dropped tag loses its markup, not the words inside it, so a chapter
    // never silently loses prose to the cleaner.
    KEEP_CONTENT: true,
  }).trim();
}

/** Exposed so a test can assert what the list does and doesn't contain. */
export const sanitiserAllowList = { tags: ALLOWED_TAGS, attributes: ALLOWED_ATTR };
