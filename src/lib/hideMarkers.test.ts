import { describe, it, expect } from "vitest";
import { isMarkerNode, markEnd } from "./hideMarkers";

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
