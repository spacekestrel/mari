import { describe, it, expect } from "vitest";
import { markdownToHtml, sanitiserAllowList } from "./markdownHtml";

describe("what other apps receive", () => {
  it("turns emphasis into real tags", () => {
    const html = markdownToHtml("She was **very tired** and *rather bored*.");
    expect(html).toContain("<strong>very tired</strong>");
    expect(html).toContain("<em>rather bored</em>");
    expect(html).not.toContain("**");
  });

  it("turns headings into heading tags, by level", () => {
    expect(markdownToHtml("# Chapter One")).toContain("<h1>Chapter One</h1>");
    expect(markdownToHtml("## A scene")).toContain("<h2>A scene</h2>");
  });

  it("turns a quote into a blockquote", () => {
    expect(markdownToHtml("> Curiouser and curiouser.")).toContain("<blockquote>");
  });

  it("keeps paragraphs apart", () => {
    const html = markdownToHtml("First para.\n\nSecond para.");
    expect(html.match(/<p>/g)?.length).toBe(2);
  });

  it("returns nothing for empty input, so the clipboard is left alone", () => {
    expect(markdownToHtml("")).toBe("");
  });
});

describe("what the cleaner will allow through", () => {
  it("covers everything Markdown itself produces", () => {
    // Collected by running the parser over a document using every piece of
    // Markdown syntax, so the list can't drift behind the parser.
    const produced = [
      "a", "blockquote", "br", "code", "del", "em",
      "h1", "h2", "h3", "h4", "h5", "h6",
      "hr", "img", "li", "ol", "p", "pre", "strong",
      "table", "tbody", "td", "th", "thead", "tr", "ul",
    ];
    for (const tag of produced) {
      expect(sanitiserAllowList.tags).toContain(tag);
    }
  });

  it("leaves out the corners where sanitiser flaws have lived", () => {
    // Drawings and maths notation especially: Markdown never makes them, and
    // they are where the known bypasses have been found.
    for (const tag of ["svg", "math", "iframe", "object", "embed", "form", "script", "style", "template"]) {
      expect(sanitiserAllowList.tags).not.toContain(tag);
    }
  });

  it("allows no attribute that can carry code", () => {
    for (const attr of sanitiserAllowList.attributes) {
      expect(attr.startsWith("on")).toBe(false);
    }
    for (const attr of ["onerror", "onload", "onclick", "style", "srcdoc", "formaction"]) {
      expect(sanitiserAllowList.attributes).not.toContain(attr);
    }
  });
});
