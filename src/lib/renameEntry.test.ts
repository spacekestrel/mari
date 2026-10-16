import { describe, expect, it } from "vitest";
import { renameProblem, selectionForRename, renamedPath } from "./renameEntry";

describe("renameProblem", () => {
  it("accepts an ordinary new name", () => {
    expect(renameProblem("one.mari", "two.mari")).toBeNull();
  });

  it("refuses an empty name, or one that is only spaces", () => {
    expect(renameProblem("one.mari", "")).toBe("empty");
    expect(renameProblem("one.mari", "   ")).toBe("empty");
  });

  it("says nothing changed rather than treating it as a failure", () => {
    expect(renameProblem("one.mari", "one.mari")).toBe("unchanged");
  });

  it("refuses characters a file system won't take", () => {
    const bad = ["a/b", "a\\b", "a:b", "a*b", "a?b", 'a"b', "a<b", "a>b", "a|b"];
    for (const name of bad) {
      expect(renameProblem("one.mari", name), name).toBe("forbidden");
    }
  });

  it("refuses the names that mean a folder", () => {
    expect(renameProblem("one.mari", ".")).toBe("reserved");
    expect(renameProblem("one.mari", "..")).toBe("reserved");
  });

  it("refuses a name already used in that folder", () => {
    expect(renameProblem("one.mari", "two.mari", ["two.mari", "three.mari"])).toBe("taken");
  });

  it("refuses one that differs only in case", () => {
    // Fine on Linux, silently overwrites on macOS and Windows.
    expect(renameProblem("one.mari", "Two.mari", ["two.mari"])).toBe("taken");
  });

  it("lets a file change its own capitalisation", () => {
    expect(renameProblem("one.mari", "One.mari", ["one.mari"])).toBeNull();
  });

  it("trims the spaces either side rather than refusing the name", () => {
    expect(renameProblem("one.mari", "  two.mari  ")).toBeNull();
  });

  it("allows the spaces and dashes real chapter names carry", () => {
    expect(renameProblem("one.mari", "09 - The Mock Turtle.mari")).toBeNull();
  });
});

describe("selectionForRename", () => {
  it("selects the name without its extension", () => {
    expect(selectionForRename("chapter.mari")).toEqual({ from: 0, to: 7 });
  });

  it("stops at the last dot, not the first", () => {
    expect(selectionForRename("chapter.v2.mari")).toEqual({ from: 0, to: 10 });
  });

  it("selects the whole of a name with no extension", () => {
    expect(selectionForRename("ARC II")).toEqual({ from: 0, to: 6 });
  });

  it("selects the whole of a dotfile, which has no extension to keep", () => {
    expect(selectionForRename(".gitignore")).toEqual({ from: 0, to: 10 });
  });
});

describe("renamedPath", () => {
  it("keeps the folder and changes the last part", () => {
    expect(renamedPath("/books/arc/one.mari", "two.mari")).toBe("/books/arc/two.mari");
  });

  it("handles a bare name with no folder above it", () => {
    expect(renamedPath("one.mari", "two.mari")).toBe("two.mari");
  });
});
