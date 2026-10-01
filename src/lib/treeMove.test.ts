import { describe, it, expect } from "vitest";
import { canDrop, isWithin, parentPath, pathAfterMove, joinPath, remapWithin, forgetWithin } from "./treeMove";

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

describe("remapWithin", () => {
  const store = () =>
    new Map([
      ["/books/arc/one.mari", "one"],
      ["/books/arc/deep/two.mari", "two"],
      ["/books/other/three.mari", "three"],
    ]);

  it("follows a folder and everything under it", () => {
    const s = store();
    remapWithin(s, "/books/arc", "/books/moved");
    expect([...s.keys()].sort()).toEqual([
      "/books/moved/deep/two.mari",
      "/books/moved/one.mari",
      "/books/other/three.mari",
    ]);
  });

  it("keeps what it carried", () => {
    const s = store();
    remapWithin(s, "/books/arc/one.mari", "/books/arc/renamed.mari");
    expect(s.get("/books/arc/renamed.mari")).toBe("one");
  });

  it("leaves a folder with a similar name alone", () => {
    // "/books/arc2" starts with "/books/arc" as text but isn't inside it.
    const s = new Map([["/books/arc2/x.mari", "x"]]);
    remapWithin(s, "/books/arc", "/books/moved");
    expect([...s.keys()]).toEqual(["/books/arc2/x.mari"]);
  });
});

describe("forgetWithin", () => {
  it("drops a file", () => {
    const s = new Map([["/books/one.mari", 1], ["/books/two.mari", 2]]);
    forgetWithin(s, "/books/one.mari");
    expect([...s.keys()]).toEqual(["/books/two.mari"]);
  });

  it("drops a folder and everything inside it", () => {
    const s = new Map([
      ["/books/arc", 0],
      ["/books/arc/one.mari", 1],
      ["/books/arc/deep/two.mari", 2],
      ["/books/other.mari", 3],
    ]);
    forgetWithin(s, "/books/arc");
    expect([...s.keys()]).toEqual(["/books/other.mari"]);
  });

  it("leaves a folder with a similar name alone", () => {
    const s = new Map([["/books/arc2/x.mari", 1]]);
    forgetWithin(s, "/books/arc");
    expect([...s.keys()]).toEqual(["/books/arc2/x.mari"]);
  });

  it("does nothing when nothing matches", () => {
    const s = new Map([["/books/one.mari", 1]]);
    forgetWithin(s, "/elsewhere");
    expect(s.size).toBe(1);
  });
});
