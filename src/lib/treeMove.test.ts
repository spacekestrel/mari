import { describe, it, expect } from "vitest";
import { canDrop, isWithin, parentPath, pathAfterMove, joinPath } from "./treeMove";

const dir = (path: string) => ({ path, kind: "directory" });
const file = (path: string) => ({ path, kind: "file" });

describe("what can be dropped where", () => {
  it("allows a file into another folder", () => {
    expect(canDrop(file("/book/ARC I/7.mari"), dir("/book/ARC II"))).toBe(true);
  });

  it("allows a folder into another folder", () => {
    expect(canDrop(dir("/book/ARC I"), dir("/book/Archive"))).toBe(true);
  });

  it("refuses a drop onto a file", () => {
    expect(canDrop(file("/book/7.mari"), file("/book/8.mari"))).toBe(false);
  });

  it("refuses a drop onto itself", () => {
    expect(canDrop(dir("/book/ARC I"), dir("/book/ARC I"))).toBe(false);
  });

  it("refuses a drop back where it already is", () => {
    expect(canDrop(file("/book/ARC I/7.mari"), dir("/book/ARC I"))).toBe(false);
  });

  it("refuses a folder into its own child", () => {
    // This is the one that would lose the folder entirely: moved inside
    // itself, it has nowhere to be.
    expect(canDrop(dir("/book/ARC I"), dir("/book/ARC I/scenes"))).toBe(false);
  });

  it("refuses a folder into a distant descendant", () => {
    expect(canDrop(dir("/book/ARC I"), dir("/book/ARC I/scenes/drafts/old"))).toBe(false);
  });

  it("allows a folder into a sibling with a similar name", () => {
    // "/book/ARC I" must not count as an ancestor of "/book/ARC II".
    expect(canDrop(dir("/book/ARC I"), dir("/book/ARC II"))).toBe(true);
  });
});

describe("path arithmetic", () => {
  it("knows what contains what", () => {
    expect(isWithin("/book/ARC I/7.mari", "/book/ARC I")).toBe(true);
    expect(isWithin("/book/ARC I", "/book/ARC I")).toBe(true);
    expect(isWithin("/book/ARC II/7.mari", "/book/ARC I")).toBe(false);
  });

  it("finds the containing folder", () => {
    expect(parentPath("/book/ARC I/7.mari")).toBe("/book/ARC I");
    expect(parentPath("/7.mari")).toBe("");
  });

  it("joins without doubling the separator", () => {
    expect(joinPath("/book", "7.mari")).toBe("/book/7.mari");
    expect(joinPath("/book/", "7.mari")).toBe("/book/7.mari");
  });
});

describe("following things that were filed by path", () => {
  it("rewrites a file's own path", () => {
    expect(pathAfterMove("/book/ARC I/7.mari", "/book/ARC I/7.mari", "/book/ARC II/7.mari"))
      .toBe("/book/ARC II/7.mari");
  });

  it("rewrites everything under a moved folder", () => {
    // Unsaved work and reading positions are filed by path; missing these
    // would strand them under a name nothing points at.
    expect(pathAfterMove("/book/ARC I/scenes/7.mari", "/book/ARC I", "/book/Archive/ARC I"))
      .toBe("/book/Archive/ARC I/scenes/7.mari");
  });

  it("leaves unrelated paths alone", () => {
    expect(pathAfterMove("/book/ARC II/9.mari", "/book/ARC I", "/book/Archive/ARC I"))
      .toBe("/book/ARC II/9.mari");
  });

  it("does not rewrite a sibling with a similar name", () => {
    expect(pathAfterMove("/book/ARC II/9.mari", "/book/ARC I", "/book/Archive"))
      .toBe("/book/ARC II/9.mari");
  });
});
