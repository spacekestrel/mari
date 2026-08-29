import { describe, it, expect } from "vitest";
import { zipSync, strToU8, unzipSync, strFromU8 } from "fflate";
import { docxToMarkdown, markdownToDocx, isDocxFile } from "./docx";

/** Wraps body XML in the minimum a reader needs, to test parsing in isolation. */
function wordFile(bodyXml: string): Uint8Array {
  return zipSync({
    "word/document.xml": strToU8(
      `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${bodyXml}</w:body></w:document>`,
    ),
  });
}

const para = (runs: string, props = "") => `<w:p>${props}${runs}</w:p>`;
const run = (text: string, props = "") =>
  `<w:r>${props}<w:t xml:space="preserve">${text}</w:t></w:r>`;

describe("isDocxFile", () => {
  it("matches regardless of case", () => {
    expect(isDocxFile("Chapter.DOCX")).toBe(true);
    expect(isDocxFile("chapter.docx")).toBe(true);
  });

  it("does not match .doc or .mari", () => {
    expect(isDocxFile("old.doc")).toBe(false);
    expect(isDocxFile("chapter.mari")).toBe(false);
  });
});

describe("reading Word documents", () => {
  it("reads paragraphs as Markdown paragraphs", () => {
    const file = wordFile(para(run("First.")) + para(run("Second.")));
    expect(docxToMarkdown(file)).toBe("First.\n\nSecond.");
  });

  it("reads headings from their style", () => {
    const file = wordFile(
      para(run("The Title"), '<w:pPr><w:pStyle w:val="Heading1"/></w:pPr>') +
        para(run("A scene"), '<w:pPr><w:pStyle w:val="Heading3"/></w:pPr>') +
        para(run("Prose.")),
    );
    expect(docxToMarkdown(file)).toBe("# The Title\n\n### A scene\n\nProse.");
  });

  it("keeps bold and italic", () => {
    const file = wordFile(
      para(run("plain ") + run("bold", "<w:rPr><w:b/></w:rPr>") + run(" and ") + run("slanted", "<w:rPr><w:i/></w:rPr>")),
    );
    expect(docxToMarkdown(file)).toBe("plain **bold** and *slanted*");
  });

  it("treats an explicitly-off toggle as off", () => {
    // Inherited from a style then switched back — Word shows this as plain.
    const file = wordFile(para(run("not bold", '<w:rPr><w:b w:val="0"/></w:rPr>')));
    expect(docxToMarkdown(file)).toBe("not bold");
  });

  it("joins runs Word split mid-word", () => {
    // Word splits runs at spell-check and revision boundaries constantly.
    const file = wordFile(para(run("Won") + run("der") + run("land")));
    expect(docxToMarkdown(file)).toBe("Wonderland");
  });

  it("emphasises a split-up phrase once, not run by run", () => {
    // Three bold runs unmerged would come out as `**Won****der****land**`.
    const bold = "<w:rPr><w:b/></w:rPr>";
    const file = wordFile(para(run("Won", bold) + run("der", bold) + run("land", bold)));
    expect(docxToMarkdown(file)).toBe("**Wonderland**");
  });

  it("does not emit stray asterisks when emphasis wraps a space", () => {
    const file = wordFile(para(run("a") + run(" ", "<w:rPr><w:b/></w:rPr>") + run("b")));
    expect(docxToMarkdown(file)).toBe("a b");
  });

  it("moves emphasis padding outside the marker", () => {
    const file = wordFile(para(run("say ") + run("this ", "<w:rPr><w:i/></w:rPr>") + run("now")));
    expect(docxToMarkdown(file)).toBe("say *this* now");
  });

  it("decodes XML entities", () => {
    const file = wordFile(para(run("Tweedledum &amp; Tweedledee &#8212; &quot;hello&quot;")));
    expect(docxToMarkdown(file)).toBe('Tweedledum & Tweedledee — "hello"');
  });

  it("turns soft breaks and tabs into characters, not markup", () => {
    const file = wordFile(para(`<w:r><w:t>one</w:t><w:br/><w:t>two</w:t></w:r>`));
    expect(docxToMarkdown(file)).toBe("one\ntwo");
  });

  it("drops tracked deletions rather than resurrecting them", () => {
    const file = wordFile(
      para(
        run("The cat sat ") +
          `<w:del w:id="1" w:author="Editor"><w:r><w:delText>badly </w:delText></w:r></w:del>` +
          run("down."),
      ),
    );
    expect(docxToMarkdown(file)).toBe("The cat sat down.");
  });

  it("drops a deletion even when it holds ordinary text elements", () => {
    // `w:delText` alone would never be read, but not every producer uses it —
    // the deletion has to go as a whole, whatever it contains.
    const file = wordFile(
      para(run("The cat sat ") + `<w:del w:id="2">${run("badly ")}</w:del>` + run("down.")),
    );
    expect(docxToMarkdown(file)).toBe("The cat sat down.");
  });

  it("does not run empty paragraphs together into big gaps", () => {
    const file = wordFile(para(run("One.")) + para("") + para("") + para(run("Two.")));
    expect(docxToMarkdown(file)).toBe("One.\n\nTwo.");
  });

  it("refuses a file that is not a zip", () => {
    expect(() => docxToMarkdown(strToU8("this is a plain text file"))).toThrow(/readable \.docx/);
  });

  it("refuses a zip with no document part", () => {
    expect(() => docxToMarkdown(zipSync({ "hello.txt": strToU8("hi") }))).toThrow(/no document part/);
  });
});

describe("writing Word documents", () => {
  const documentXml = (bytes: Uint8Array) => strFromU8(unzipSync(bytes)["word/document.xml"]);

  it("produces the parts a Word document must have", () => {
    const parts = Object.keys(unzipSync(markdownToDocx("Hello.")));
    expect(parts).toEqual(
      expect.arrayContaining([
        "[Content_Types].xml",
        "_rels/.rels",
        "word/_rels/document.xml.rels",
        "word/document.xml",
        "word/styles.xml",
      ]),
    );
  });

  it("declares the heading styles it references", () => {
    // A pStyle pointing at a style that isn't declared renders as body text.
    const files = unzipSync(markdownToDocx("# Title"));
    expect(strFromU8(files["word/styles.xml"])).toContain('w:styleId="Heading1"');
  });

  it("escapes characters that would break the XML", () => {
    const xml = documentXml(markdownToDocx('Tom & Jerry <said> "no"'));
    expect(xml).toContain("Tom &amp; Jerry &lt;said&gt; &quot;no&quot;");
  });

  it("strips control characters Word would reject", () => {
    const xml = documentXml(markdownToDocx("before\x07after"));
    expect(xml).not.toContain("\x07");
    expect(xml).toContain("beforeafter");
  });

  it("keeps whitespace rather than letting Word collapse it", () => {
    expect(documentXml(markdownToDocx("a  b"))).toContain('xml:space="preserve"');
  });
});

describe("round trip", () => {
  const roundTrip = (text: string) => docxToMarkdown(markdownToDocx(text));

  it("preserves prose, headings and emphasis", () => {
    const text = "# Chapter One\n\nAlice was **bored**.\n\nShe was *very* bored.\n\n## Later\n\nThe end.";
    expect(roundTrip(text)).toBe(text);
  });

  it("preserves both italic spellings as one", () => {
    expect(roundTrip("a _word_ here")).toBe("a *word* here");
  });

  it("preserves apostrophes and dashes", () => {
    const text = "Alice's sister — who didn't look up — said “no”.";
    expect(roundTrip(text)).toBe(text);
  });

  it("survives a long manuscript unchanged", () => {
    const text = Array.from({ length: 200 }, (_, i) => `Paragraph ${i} with **bold** in it.`).join("\n\n");
    expect(roundTrip(text)).toBe(text);
  });

  it("does not accumulate blank lines over repeated trips", () => {
    const text = "# Title\n\nOne.\n\nTwo.";
    expect(roundTrip(roundTrip(roundTrip(text)))).toBe(text);
  });
});
