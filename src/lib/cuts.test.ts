import { describe, expect, it } from "vitest";
import { CUT_CONTEXT_CHARS, describeCut, findPutBackPosition, newCutId } from "./cuts";
import type { MariCut } from "./mariBundle";

/**
 * A passage in the drawer is out of the prose and out of the clipboard, so
 * these two decisions are the whole safety of the feature: what gets captured
 * when it leaves, and where it lands when it comes back.
 */

const DOC = "Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.\n";
const at = (needle: string) => DOC.indexOf(needle);

describe("capturing a cut", () => {
  it("takes exactly the selected words", () => {
    const cut = describeCut(DOC, at("Beta"), at("Beta") + "Beta paragraph.".length);
    expect(cut?.text).toBe("Beta paragraph.");
  });

  it("remembers the prose either side, so it can go back where it was", () => {
    const cut = describeCut(DOC, at("Beta"), at("Beta") + "Beta paragraph.".length);
    expect(cut?.before).toBe("Alpha paragraph.\n\n");
    expect(cut?.after).toBe("\n\nGamma paragraph.\n");
  });

  it("refuses a selection with nothing in it", () => {
    expect(describeCut(DOC, 0, 0)).toBeNull();
    expect(describeCut("   \n\n  ", 0, 7)).toBeNull();
  });

  it("does not run off either end of the document", () => {
    const long = "x".repeat(500);
    const cut = describeCut(long, 0, 10);
    expect(cut?.before).toBe("");
    expect(cut?.after).toHaveLength(CUT_CONTEXT_CHARS);

    const atEnd = describeCut(long, 490, 500);
    expect(atEnd?.after).toBe("");
    expect(atEnd?.before).toHaveLength(CUT_CONTEXT_CHARS);
  });

  it("copes with a backwards selection", () => {
    const forwards = describeCut(DOC, at("Beta"), at("Beta") + 4, { id: "x", cutAt: "" });
    const backwards = describeCut(DOC, at("Beta") + 4, at("Beta"), { id: "x", cutAt: "" });
    expect(backwards).toEqual(forwards);
  });

  it("gives every cut its own id", () => {
    expect(newCutId()).not.toBe(newCutId());
  });
});

describe("putting a cut back", () => {
  const cut = (over: Partial<MariCut>): MariCut => ({
    id: "c1",
    text: "Beta paragraph.\n\n",
    cutAt: "",
    ...over,
  });

  it("lands in the exact spot it came from", () => {
    const without = "Alpha paragraph.\n\nGamma paragraph.\n";
    const where = findPutBackPosition(without, cut({ before: "Alpha paragraph.\n\n" }), 0);
    expect(without.slice(0, where) + "Beta paragraph.\n\n" + without.slice(where)).toBe(DOC);
  });

  it("uses the words after it when the ones before are gone", () => {
    const doc = "Completely rewritten opening.\n\nGamma paragraph.\n";
    const where = findPutBackPosition(doc, cut({ before: "Alpha paragraph.\n\n", after: "Gamma paragraph.\n" }), 0);
    expect(doc.slice(where)).toBe("Gamma paragraph.\n");
  });

  it("refuses to guess when the surrounding words appear twice", () => {
    const doc = "Repeat.\n\nRepeat.\n\nEnd.\n";
    const where = findPutBackPosition(doc, cut({ before: "Repeat.\n\n", after: "End.\n" }), 0);
    // Not after either "Repeat." — it fell through to the unambiguous `after`.
    expect(where).toBe(doc.indexOf("End."));
  });

  it("drops it at the cursor when nothing is recognisable", () => {
    const doc = "Nothing familiar here.\n";
    expect(findPutBackPosition(doc, cut({ before: "gone", after: "also gone" }), 7)).toBe(7);
  });

  it("drops it at the cursor when no context was recorded", () => {
    expect(findPutBackPosition(DOC, cut({}), 5)).toBe(5);
  });

  it("never lands outside the document, however stale the cursor is", () => {
    const doc = "Short.\n";
    expect(findPutBackPosition(doc, cut({}), 9999)).toBe(doc.length);
    expect(findPutBackPosition(doc, cut({}), -20)).toBe(0);
  });

  it("puts a passage back byte for byte, round trip", () => {
    const from = at("Beta");
    const to = from + "Beta paragraph.\n\n".length;
    const taken = describeCut(DOC, from, to)!;
    const without = DOC.slice(0, from) + DOC.slice(to);
    const where = findPutBackPosition(without, taken, 0);
    expect(without.slice(0, where) + taken.text + without.slice(where)).toBe(DOC);
  });
});
