import { describe, it, expect } from "vitest";
import { isMarkerNode, touchedBySelection, markEnd } from "./hideMarkers";

describe("which nodes are punctuation", () => {
  it("treats every marker the format bar can produce as punctuation", () => {
    for (const n of ["EmphasisMark", "StrikethroughMark", "HeaderMark", "QuoteMark"]) {
      expect(isMarkerNode(n)).toBe(true);
    }
  });

  it("leaves prose nodes alone", () => {
    for (const n of ["Paragraph", "Emphasis", "StrongEmphasis", "ATXHeading1", "Document"]) {
      expect(isMarkerNode(n)).toBe(false);
    }
  });
});

describe("revealing markers under the cursor", () => {
  const cursor = (at: number) => [{ from: at, to: at }];

  it("reveals when the caret is inside the construct", () => {
    expect(touchedBySelection(cursor(5), 0, 10)).toBe(true);
  });

  it("reveals when the caret sits at either edge", () => {
    // Backspacing at the boundary would otherwise delete an invisible character.
    expect(touchedBySelection(cursor(0), 0, 10)).toBe(true);
    expect(touchedBySelection(cursor(10), 0, 10)).toBe(true);
  });

  it("stays hidden when the caret is elsewhere", () => {
    expect(touchedBySelection(cursor(20), 0, 10)).toBe(false);
    expect(touchedBySelection(cursor(0), 5, 10)).toBe(false);
  });

  it("reveals when a selection overlaps the construct", () => {
    expect(touchedBySelection([{ from: 8, to: 30 }], 0, 10)).toBe(true);
  });

  it("handles several cursors, revealing if any one touches", () => {
    expect(touchedBySelection([{ from: 50, to: 50 }, { from: 3, to: 3 }], 0, 10)).toBe(true);
    expect(touchedBySelection([{ from: 50, to: 50 }, { from: 80, to: 80 }], 0, 10)).toBe(false);
  });
});

describe("swallowing the space after a marker", () => {
  it("extends past the space for headings and quotes", () => {
    // `#` and `>` are their own node; without this every heading sits one
    // space in from the margin.
    expect(markEnd(" Chapter One", "HeaderMark", 1)).toBe(2);
    expect(markEnd(" Curiouser", "QuoteMark", 1)).toBe(2);
  });

  it("leaves emphasis markers alone", () => {
    // `**very**` has no space to eat; taking one would delete a real space.
    expect(markEnd(" very", "EmphasisMark", 5)).toBe(5);
    expect(markEnd(" cut", "StrikethroughMark", 5)).toBe(5);
  });

  it("copes with no space at all", () => {
    expect(markEnd("Chapter", "HeaderMark", 1)).toBe(1);
  });
});
