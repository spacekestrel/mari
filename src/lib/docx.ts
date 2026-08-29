import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";

/**
 * Word documents, read and written directly.
 *
 * A `.docx` is a zip of XML, the same as a `.mari` file is a zip of JSON, so
 * this needs no library beyond the one already unpacking bundles.
 *
 * What crosses the boundary is prose: paragraphs, headings, bold and italic.
 * That is the honest overlap between Word and Mari — everything else Word can
 * hold (comments, tracked changes, tables, images) has nowhere to go in a
 * plain-Markdown editor, and silently dropping it on save would be worse than
 * not claiming to support it. Highlights, notes and the drawer stay behind
 * too, for the same reason `.txt` can't carry them: keep those in `.mari`.
 */
export const DOCX_EXTENSION = ".docx";

const DOCUMENT = "word/document.xml";

export function isDocxFile(name: string): boolean {
  return name.toLowerCase().endsWith(DOCX_EXTENSION);
}

/* ------------------------------------------------------------------ */
/* Reading                                                             */
/* ------------------------------------------------------------------ */

const ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
};

function decodeXml(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (whole, body: string) => {
    if (body[0] === "#") {
      const code =
        body[1] === "x" || body[1] === "X"
          ? parseInt(body.slice(2), 16)
          : parseInt(body.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : whole;
    }
    return ENTITIES[body] ?? whole;
  });
}

/**
 * Word writes a toggle as `<w:b/>`, but also as `<w:b w:val="0"/>` to mean
 * explicitly off — inherited from a style and then switched back. Treating any
 * appearance as "on" would bold text that Word shows as plain.
 */
function toggledOn(runProps: string, tag: string): boolean {
  const found = runProps.match(new RegExp(`<w:${tag}(\\s[^>]*)?/?>`));
  if (!found) return false;
  const value = found[1]?.match(/w:val="([^"]*)"/)?.[1];
  return value === undefined || !["0", "false", "off"].includes(value);
}

interface Run {
  text: string;
  bold: boolean;
  italic: boolean;
}

/** Pulls the visible text out of one `<w:p>`, run by run, keeping emphasis. */
function readRuns(paragraph: string): Run[] {
  const runs: Run[] = [];
  const pattern = /<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>/g;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(paragraph))) {
    const body = match[1];
    const props = body.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)?.[1] ?? "";
    // `w:bCs` is bold for complex scripts and deliberately not consulted here;
    // it travels with `w:b` on real documents and would only double-count.
    const bold = toggledOn(props, "b");
    const italic = toggledOn(props, "i");

    let text = "";
    const inner =
      /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>|<w:noBreakHyphen\s*\/>/g;
    let piece: RegExpExecArray | null;
    while ((piece = inner.exec(body))) {
      if (piece[0].startsWith("<w:tab")) text += "\t";
      else if (piece[0].startsWith("<w:br")) text += "\n";
      else if (piece[0].startsWith("<w:noBreakHyphen")) text += "-";
      else text += decodeXml(piece[1]);
    }
    if (text) runs.push({ text, bold, italic });
  }
  return runs;
}

/** `**` around an empty string renders as literal asterisks, so guard it. */
function emphasise(run: Run): string {
  if (!run.bold && !run.italic) return run.text;

  // Word happily bolds the space between two words; Markdown can't, and
  // `** **` would show the asterisks. Move the padding outside the marker.
  const lead = run.text.match(/^\s*/)![0];
  const tail = run.text.match(/\s*$/)![0];
  const core = run.text.slice(lead.length, run.text.length - tail.length);
  if (!core) return run.text;

  let wrapped = core;
  if (run.bold) wrapped = `**${wrapped}**`;
  if (run.italic) wrapped = `*${wrapped}*`;
  return lead + wrapped + tail;
}

/** Adjacent runs with identical emphasis are one span; Word splits them freely. */
function mergeRuns(runs: Run[]): Run[] {
  const merged: Run[] = [];
  for (const run of runs) {
    const last = merged[merged.length - 1];
    if (last && last.bold === run.bold && last.italic === run.italic) last.text += run.text;
    else merged.push({ ...run });
  }
  return merged;
}

function headingLevel(props: string): number {
  const style = props.match(/<w:pStyle\s+w:val="([^"]*)"/)?.[1] ?? "";
  const level = style.match(/^Heading\s*([1-6])$/i)?.[1];
  return level ? Number(level) : 0;
}

/**
 * Turns a Word document into Markdown.
 *
 * Throws if the bytes aren't a readable `.docx`, so callers can report a bad
 * file rather than opening an empty chapter over the top of someone's work.
 */
export function docxToMarkdown(bytes: Uint8Array): string {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("That file isn't a readable .docx — it may be an older .doc, or damaged.");
  }
  const document = files[DOCUMENT];
  if (!document) throw new Error("That .docx has no document part, so there's nothing to open.");

  let xml = strFromU8(document);
  // Tracked deletions are not in the document as it reads; dropping the whole
  // element keeps removed words from reappearing in the manuscript.
  xml = xml.replace(/<w:del\s[\s\S]*?<\/w:del>/g, "");

  const body = xml.match(/<w:body>([\s\S]*)<\/w:body>/)?.[1] ?? xml;
  const blocks: string[] = [];
  const paragraphs = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>|<w:p(?:\s[^>]*)?\/>/g;
  let match: RegExpExecArray | null;

  while ((match = paragraphs.exec(body))) {
    const inner = match[1] ?? "";
    const props = inner.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/)?.[1] ?? "";
    const text = mergeRuns(readRuns(inner)).map(emphasise).join("").trim();

    if (!text) {
      blocks.push("");
      continue;
    }
    const level = headingLevel(props);
    blocks.push(level ? `${"#".repeat(level)} ${text}` : text);
  }

  // Word marks a paragraph break per paragraph; Markdown wants a blank line
  // between them, and empty Word paragraphs shouldn't compound into gaps.
  return blocks
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/* ------------------------------------------------------------------ */
/* Writing                                                             */
/* ------------------------------------------------------------------ */

/** Characters XML 1.0 cannot represent at all — Word rejects the whole file. */
// eslint-disable-next-line no-control-regex
const ILLEGAL = /[\x00-\x08\x0B\x0C\x0E-\x1F\uFFFE\uFFFF]/g;

function escapeXml(text: string): string {
  return text
    .replace(ILLEGAL, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function runXml(text: string, bold: boolean, italic: boolean): string {
  const props =
    bold || italic ? `<w:rPr>${bold ? "<w:b/>" : ""}${italic ? "<w:i/>" : ""}</w:rPr>` : "";
  // Line breaks inside a paragraph stay inside it, as Word's own soft break.
  const body = escapeXml(text)
    .split("\n")
    .map((part) => `<w:t xml:space="preserve">${part}</w:t>`)
    .join("<w:br/>");
  return `<w:r>${props}${body}</w:r>`;
}

/**
 * Splits one line of Markdown into runs. Handles `**bold**`, `*italic*` and
 * `_italic_`, which is the emphasis Mari's own reading view renders — anything
 * more elaborate is passed through as the characters the writer typed.
 */
function inlineRuns(line: string): string {
  const pattern = /(\*\*\*|\*\*|\*|__|_)(?=\S)([\s\S]*?\S)\1/g;
  let out = "";
  let at = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(line))) {
    if (match.index > at) out += runXml(line.slice(at, match.index), false, false);
    const marker = match[1];
    const bold = marker === "**" || marker === "__" || marker === "***";
    const italic = marker === "*" || marker === "_" || marker === "***";
    out += runXml(match[2], bold, italic);
    at = match.index + match[0].length;
  }
  if (at < line.length) out += runXml(line.slice(at), false, false);
  return out;
}

function paragraphXml(text: string): string {
  const heading = text.match(/^(#{1,6})\s+(.*)$/);
  if (heading) {
    return `<w:p><w:pPr><w:pStyle w:val="Heading${heading[1].length}"/></w:pPr>${inlineRuns(heading[2])}</w:p>`;
  }
  return `<w:p>${inlineRuns(text)}</w:p>`;
}

const CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
</Types>`;

const ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

const DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

/**
 * Heading styles have to be declared or Word shows them as body text — the
 * `pStyle` reference alone isn't enough. Body text is manuscript-standard:
 * 12pt serif, double-spaced, indented first line.
 */
const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/></w:rPr></w:rPrDefault></w:docDefaults>
<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:pPr><w:spacing w:line="480" w:lineRule="auto"/><w:ind w:firstLine="720"/></w:pPr></w:style>
${[1, 2, 3, 4, 5, 6]
  .map(
    (n) =>
      `<w:style w:type="paragraph" w:styleId="Heading${n}"><w:name w:val="heading ${n}"/><w:basedOn w:val="Normal"/><w:pPr><w:keepNext/><w:spacing w:before="240" w:after="120" w:line="240" w:lineRule="auto"/><w:ind w:firstLine="0"/><w:outlineLvl w:val="${n - 1}"/></w:pPr><w:rPr><w:b/><w:sz w:val="${32 - n * 2}"/></w:rPr></w:style>`,
  )
  .join("\n")}
</w:styles>`;

/** Turns Markdown into the bytes of a `.docx` Word and Google Docs will open. */
export function markdownToDocx(text: string): Uint8Array {
  const body = text
    .replace(/\r\n/g, "\n")
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter((block) => block.length > 0)
    .map(paragraphXml)
    .join("");

  const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${body}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr></w:body></w:document>`;

  return zipSync(
    {
      "[Content_Types].xml": strToU8(CONTENT_TYPES),
      "_rels/.rels": strToU8(ROOT_RELS),
      "word/_rels/document.xml.rels": strToU8(DOC_RELS),
      "word/document.xml": strToU8(document),
      "word/styles.xml": strToU8(STYLES),
    },
    { level: 6 },
  );
}
