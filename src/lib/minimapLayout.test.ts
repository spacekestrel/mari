import { describe, expect, it } from "vitest";
import { MIN_INDICATOR_PX, viewportIndicator, withAlpha, wrapLineIntoRows } from "./minimapLayout";

/**
 * The minimap's early bugs were all here: rows that didn't fill the width, an
 * uneven right-hand edge, a viewport box too small to see on a long chapter.
 */

/** Rows must tile the line exactly: no gaps, no overlaps, nothing dropped. */
function assertCoversLine(text: string, rows: { from: number; to: number }[]) {
  expect(rows[0].from).toBe(0);
  expect(rows.at(-1)!.to).toBe(text.length);
  for (let i = 1; i < rows.length; i++) expect(rows[i].from).toBe(rows[i - 1].to);
  expect(rows.map((r) => text.slice(r.from, r.to)).join("")).toBe(text);
}

describe("breaking a line into rows", () => {
  const width = 100;
  const charWidth = 10; // so ten characters per row

  it("gives an empty line a row of its own, keeping paragraph breaks", () => {
    expect(wrapLineIntoRows("", width, charWidth)).toEqual([{ from: 0, to: 0 }]);
  });

  it("leaves a short line on one row", () => {
    expect(wrapLineIntoRows("short", width, charWidth)).toEqual([{ from: 0, to: 5 }]);
  });

  it("wraps on whole words, never mid-word", () => {
    const text = "alpha beta gamma delta";
    const rows = wrapLineIntoRows(text, width, charWidth);
    // Every row boundary lands on whitespace, so no word is cut in half.
    for (const row of rows.slice(0, -1)) expect(text[row.to]).toMatch(/\s/);
    assertCoversLine(text, rows);
  });

  it("loses nothing, whatever the line", () => {
    const lines = [
      "one two three four five six seven eight nine ten",
      "a".repeat(200),
      "   leading and trailing   ",
      "word",
      "hyphen-heavy compound-words everywhere throughout",
      "кириллица тоже переносится по словам как надо",
    ];
    for (const text of lines) assertCoversLine(text, wrapLineIntoRows(text, width, charWidth));
  });

  it("keeps a word's leading space with the word it belongs to", () => {
    // This is what stopped rows falling short of the right edge: a wrapped
    // word takes its space to the next row rather than leaving it dangling.
    const text = "alphaalpha betabeta";
    const rows = wrapLineIntoRows(text, width, charWidth);
    expect(rows).toHaveLength(2);
    expect(text.slice(rows[1].from, rows[1].to)).toBe(" betabeta");
  });

  it("still breaks a word longer than the whole row", () => {
    const text = `${"x".repeat(50)} tail`;
    assertCoversLine(text, wrapLineIntoRows(text, width, charWidth));
  });

  it("copes with an absurdly narrow minimap", () => {
    const text = "alpha beta gamma";
    assertCoversLine(text, wrapLineIntoRows(text, 1, charWidth));
  });
});

describe("the viewport box", () => {
  it("sits at the top when the document is scrolled to the top", () => {
    expect(viewportIndicator(0, 1000, 200, 500).top).toBe(0);
  });

  it("is proportional to how much of the document fits on screen", () => {
    expect(viewportIndicator(0, 1000, 200, 500).height).toBe(100);
  });

  it("stays visible on a long chapter, where the true height rounds to nothing", () => {
    // 400 screens' worth of document: proportionally about one pixel.
    const { height } = viewportIndicator(0, 400_000, 1000, 500);
    expect(height).toBe(MIN_INDICATOR_PX);
  });

  it("never runs off the bottom, even at the very end of a long document", () => {
    const canvas = 500;
    const { top, height } = viewportIndicator(399_000, 400_000, 1000, canvas);
    expect(top + height).toBeLessThanOrEqual(canvas);
  });

  it("never runs off the bottom at any scroll position", () => {
    const canvas = 500;
    for (let scrollTop = 0; scrollTop <= 9000; scrollTop += 250) {
      const { top, height } = viewportIndicator(scrollTop, 10_000, 1000, canvas);
      expect(top).toBeGreaterThanOrEqual(0);
      expect(top + height).toBeLessThanOrEqual(canvas + 0.001);
    }
  });

  it("fills the minimap when the whole document is on screen", () => {
    expect(viewportIndicator(0, 800, 800, 500)).toEqual({ top: 0, height: 500 });
  });

  it("has nothing to show before the document has a size", () => {
    expect(viewportIndicator(0, 0, 500, 500)).toEqual({ top: 0, height: 0 });
    expect(viewportIndicator(0, 1000, 500, 0)).toEqual({ top: 0, height: 0 });
  });
});

describe("restating a colour at another opacity", () => {
  it("keeps the colour and changes the opacity", () => {
    expect(withAlpha("rgba(92, 184, 92, 0.18)", 0.55)).toBe("rgba(92, 184, 92, 0.55)");
    expect(withAlpha("rgb(92,184,92)", 0.4)).toBe("rgba(92, 184, 92, 0.4)");
  });

  it("leaves a colour it doesn't recognise alone", () => {
    expect(withAlpha("#5CB85C", 0.5)).toBe("#5CB85C");
  });
});
