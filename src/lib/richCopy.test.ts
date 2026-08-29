import { describe, it, expect } from "vitest";
import { markdownToHtml } from "./richCopy";

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
