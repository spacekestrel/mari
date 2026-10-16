import { describe, expect, it } from "vitest";
import { highlightTarget } from "./highlightTarget";

const line = { from: 10, to: 40, text: "A paragraph worth marking." };

describe("highlightTarget", () => {
  it("takes the selection when there is one", () => {
    expect(highlightTarget({ from: 12, to: 20 }, line)).toEqual({ from: 12, to: 20 });
  });

  it("takes the whole paragraph when nothing is selected", () => {
    expect(highlightTarget({ from: 15, to: 15 }, line)).toEqual({ from: 10, to: 40 });
  });

  it("prefers the selection even when it sits inside the paragraph", () => {
    expect(highlightTarget({ from: 11, to: 12 }, line)).toEqual({ from: 11, to: 12 });
  });

  it("gives nothing on a blank line", () => {
    expect(highlightTarget({ from: 5, to: 5 }, { from: 5, to: 5, text: "" })).toBeNull();
    expect(highlightTarget({ from: 5, to: 9 }, { from: 5, to: 9, text: "   " })).toEqual({
      // A selection over whitespace is still the writer asking for it.
      from: 5,
      to: 9,
    });
  });

  it("gives nothing when the pointer is over no line at all", () => {
    expect(highlightTarget({ from: 3, to: 3 }, null)).toBeNull();
  });
});
