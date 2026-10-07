import { describe, expect, it } from "vitest";
import { parser, Strikethrough } from "@lezer/markdown";
import { isHidden, markEnd } from "./hideMarkers";

/**
 * The grammar as the editor configures it, and the two rules taken out of it.
 *
 * Markdown has rules that fire on things novelists type constantly, and when
 * one fires the writer gets a shape they never asked for and, worse, every
 * marker on that line stops being formatting and appears in the prose.
 */
const prose = parser.configure([{ remove: ["SetextHeading", "IndentedCode"] }, Strikethrough]);

/** What the writer would see, with the markers the editor hides taken out. */
function onScreen(text: string): string {
  const hide: { from: number; to: number }[] = [];
  prose.parse(text).iterate({
    enter: (n) => {
      if (!isHidden(n.name, n.node.parent?.name ?? null)) return;
      // The same reach the editor uses, which swallows the space after a `#`.
      hide.push({ from: n.from, to: markEnd(text.slice(n.to, n.to + 4), n.name, n.to) });
    },
  });
  let out = "";
  for (let i = 0; i < text.length; i++) {
    if (!hide.some((h) => i >= h.from && i < h.to)) out += text[i];
  }
  return out;
}

describe("indenting a paragraph", () => {
  it("does not turn the line into code, however far it is indented", () => {
    // Four spaces is Markdown's code block. A writer indenting a paragraph
    // by hand means an indented paragraph.
    for (const spaces of [1, 2, 3, 4, 5, 8]) {
      const line = " ".repeat(spaces) + "*word*";
      expect(onScreen(line), `${spaces} spaces`).toBe(" ".repeat(spaces) + "word");
    }
  });

  it("leaves a tab-indented line alone too", () => {
    expect(onScreen("\t*word*")).toBe("\tword");
  });

  it("still keeps a fenced block, which has to be asked for", () => {
    const fenced = "```\n*word*\n```";
    expect(onScreen(fenced)).toContain("*word*");
  });
});

describe("a line of dashes under a paragraph", () => {
  it("does not turn the paragraph above it into a heading", () => {
    // A novelist types dashes constantly: scene breaks, dialogue, asides.
    expect(onScreen("A paragraph\n---")).toBe("A paragraph\n---");
  });

  it("still allows a heading written with a hash", () => {
    expect(onScreen("# Chapter")).toBe("Chapter");
  });
});
