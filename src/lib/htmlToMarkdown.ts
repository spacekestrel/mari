/**
 * Formatted text pasted in from elsewhere, turned into Markdown.
 *
 * Word, Google Docs, web pages and email all put an HTML version of what you
 * copied on the clipboard alongside the plain text. Taking the plain version
 * throws the formatting away: paste a bold sentence from Word and it arrives
 * as flat prose. This reads the HTML instead, so bold stays bold.
 *
 * Only the parts a manuscript has any use for. Tables, images, colours, fonts
 * and Word's own styling have nowhere sensible to go in a chapter, so their
 * text is kept and the decoration dropped.
 */

/** Characters that would otherwise be read back as formatting they never were. */
function escapeMarkdown(text: string): string {
  return text.replace(/([*_~`[\]])/g, "\\$1");
}

/** Collapses the runs of whitespace and newlines HTML is written with. */
function flatten(text: string): string {
  return text.replace(/\s+/g, " ");
}

/** Wraps in a marker, keeping any padding outside it so it renders. */
function wrap(inner: string, marker: string): string {
  if (!inner.trim()) return inner;
  const lead = inner.match(/^\s*/)![0];
  const tail = inner.match(/\s*$/)![0];
  const core = inner.slice(lead.length, inner.length - tail.length);
  return `${lead}${marker}${core}${marker}${tail}`;
}

function childrenToMarkdown(node: Node, listDepth: number): string {
  let out = "";
  node.childNodes.forEach((child) => {
    out += nodeToMarkdown(child, listDepth);
  });
  return out;
}

function nodeToMarkdown(node: Node, listDepth: number): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return escapeMarkdown(flatten(node.textContent ?? ""));
  }
  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const inner = () => childrenToMarkdown(el, listDepth);

  switch (tag) {
    case "script":
    case "style":
    case "head":
    case "meta":
    case "link":
      return "";

    case "br":
      return "\n";
    case "hr":
      return "\n\n---\n\n";

    case "h1":
    case "h2":
    case "h3":
    case "h4":
    case "h5":
    case "h6":
      return `\n\n${"#".repeat(Number(tag[1]))} ${inner().trim()}\n\n`;

    case "strong":
    case "b":
      return wrap(inner(), "**");
    case "em":
    case "i":
      return wrap(inner(), "*");
    case "del":
    case "s":
    case "strike":
      return wrap(inner(), "~~");
    case "code":
      return wrap(inner(), "`");

    case "a": {
      const href = el.getAttribute("href");
      const text = inner().trim();
      // A link with no address, or one whose text is the address, is better
      // left as words than turned into `[text](text)`.
      if (!href || href === text || href.startsWith("javascript:")) return text;
      return `[${text}](${href})`;
    }

    case "blockquote":
      return `\n\n${inner()
        .trim()
        .split("\n")
        .map((line) => `> ${line}`)
        .join("\n")}\n\n`;

    case "ul":
    case "ol":
      return `\n\n${inner().trim()}\n\n`;

    case "li": {
      const parent = el.parentElement?.tagName.toLowerCase();
      const indent = "  ".repeat(Math.max(0, listDepth));
      const marker =
        parent === "ol" ? `${Array.from(el.parentElement!.children).indexOf(el) + 1}. ` : "- ";
      const body = childrenToMarkdown(el, listDepth + 1).trim();
      return `${indent}${marker}${body}\n`;
    }

    // Block-level containers become their own paragraph. Word wraps almost
    // everything in divs, so treating these as blocks is what keeps pasted
    // paragraphs apart instead of running them into one line.
    case "p":
    case "div":
    case "section":
    case "article":
    case "tr":
      return `\n\n${inner().trim()}\n\n`;

    // Anything else contributes its text and nothing else: spans, fonts,
    // colours and Word's own wrappers have no meaning in a manuscript.
    default:
      return inner();
  }
}

/**
 * HTML from the clipboard, as Markdown.
 *
 * Returns an empty string when there's nothing worth taking, so the caller can
 * fall back to the plain-text version rather than pasting nothing.
 */
export function htmlToMarkdown(html: string): string {
  if (!html.trim()) return "";
  const doc = new DOMParser().parseFromString(html, "text/html");
  const body = doc.body;
  if (!body) return "";

  return childrenToMarkdown(body, 0)
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}
