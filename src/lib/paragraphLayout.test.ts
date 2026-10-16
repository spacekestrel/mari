import { describe, it, expect } from "vitest";
import { lineRole } from "./paragraphLayout";

describe("which lines get an indent", () => {
  it("indents an ordinary paragraph following another", () => {
    expect(lineRole("She was very tired.", "Alice sat on the bank.")).toBe("indent");
  });

  it("leaves the very first paragraph flush", () => {
    // An indent on the opening paragraph is the usual sign that something
    // was never properly typeset.
    expect(lineRole("Alice sat on the bank.", null)).toBe("flush");
  });

  it("leaves the first paragraph after a heading flush", () => {
    expect(lineRole("Alice sat on the bank.", "# Chapter One")).toBe("flush");
    expect(lineRole("Alice sat on the bank.", "### A scene")).toBe("flush");
  });

  it("treats a blank line as a gap to close up", () => {
    expect(lineRole("", "Alice sat.")).toBe("gap");
    expect(lineRole("   ", "Alice sat.")).toBe("gap");
  });
});

describe("lines that are not prose", () => {
  it("never indents a heading", () => {
    expect(lineRole("# Chapter One", "Some prose.")).toBe("flush");
    expect(lineRole("## A scene", "Some prose.")).toBe("flush");
  });

  it("never indents a quote", () => {
    expect(lineRole("> Curiouser and curiouser.", "Some prose.")).toBe("flush");
  });

  it("never indents a list item", () => {
    for (const l of ["- first", "* first", "+ first", "1. first", "2) second"]) {
      expect(lineRole(l, "Some prose.")).toBe("flush");
    }
  });

  it("still indents a paragraph that merely starts with a dash of dialogue", () => {
    // A novelist writes dialogue with an em dash constantly; that is prose,
    // not a bullet, so it should be indented like any other paragraph.
    expect(lineRole("— I said nothing, she replied.", "Some prose.")).toBe("indent");
  });
});
