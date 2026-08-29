import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import {
  clearHighlightById,
  clearHighlights,
  createHighlightField,
  readHighlights,
  setHighlight,
} from "./highlightField";
import type { StoredHighlight } from "./highlightStore";

/**
 * Marks are the feature most tangled with everything else, and the one that
 * has lost a writer's work before: marking a few words inside a long marked
 * passage once wiped that whole passage's mark. These run the real state
 * field without a browser.
 */

const DOC = "Alpha paragraph.\n\nBeta paragraph.\n\nGamma paragraph.\n";
const at = (needle: string) => DOC.indexOf(needle);

function stateWith(initial: StoredHighlight[] = [], doc = DOC) {
  const field = createHighlightField(initial);
  return { field, state: EditorState.create({ doc, extensions: [field] }) };
}

const marks = (state: EditorState, field: ReturnType<typeof createHighlightField>) =>
  readHighlights(state.field(field), state.doc.length);

const mark = (state: EditorState, field: ReturnType<typeof createHighlightField>, doc = DOC) =>
  marks(state, field).map((h) => `${h.stateId}:${doc.slice(h.from, h.to)}`);

describe("marking a passage", () => {
  it("starts from the marks the file was saved with", () => {
    const { field, state } = stateWith([{ from: 0, to: 16, stateId: "good", id: "m1" }]);
    expect(mark(state, field)).toEqual(["good:Alpha paragraph."]);
  });

  it("ignores a saved mark with nothing in it", () => {
    const { field, state } = stateWith([{ from: 5, to: 5, stateId: "good", id: "m1" }]);
    expect(marks(state, field)).toEqual([]);
  });

  it("marks a range", () => {
    const { field, state } = stateWith();
    const next = state.update({
      effects: setHighlight.of({ from: at("Beta"), to: at("Beta") + 15, stateId: "tweak", id: "m1" }),
    }).state;
    expect(mark(next, field)).toEqual(["tweak:Beta paragraph."]);
  });

  it("clears a range when given no state", () => {
    const { field, state } = stateWith([{ from: 0, to: 16, stateId: "good", id: "m1" }]);
    const next = state.update({
      effects: setHighlight.of({ from: 0, to: 16, stateId: null, id: "m1" }),
    }).state;
    expect(marks(next, field)).toEqual([]);
  });
});

describe("marking over an existing mark", () => {
  /** One long marked passage, so overlaps can be aimed anywhere inside it. */
  const longMark: StoredHighlight[] = [{ from: 0, to: DOC.length - 1, stateId: "good", id: "long" }];

  it("keeps the parts either side when marking words in the middle", () => {
    const { field, state } = stateWith(longMark);
    const next = state.update({
      effects: setHighlight.of({ from: at("Beta"), to: at("Beta") + 15, stateId: "rewrite", id: "new" }),
    }).state;
    const result = marks(next, field);
    // The long mark survives as two pieces, with the new one between them.
    expect(result).toHaveLength(3);
    expect(result.map((h) => h.stateId)).toEqual(["good", "rewrite", "good"]);
    expect(DOC.slice(result[1].from, result[1].to)).toBe("Beta paragraph.");
  });

  it("gives the bigger surviving piece the original identity", () => {
    const { field, state } = stateWith(longMark);
    // Cut near the start, so the right-hand piece is much longer.
    const next = state.update({
      effects: setHighlight.of({ from: 2, to: 6, stateId: "rewrite", id: "new" }),
    }).state;
    const survivors = marks(next, field).filter((h) => h.stateId === "good");
    const biggest = survivors.reduce((a, b) => (b.to - b.from > a.to - a.from ? b : a));
    expect(biggest.id).toBe("long");
  });

  it("removes a mark it covers end to end", () => {
    const { field, state } = stateWith([{ from: at("Beta"), to: at("Beta") + 15, stateId: "good", id: "m1" }]);
    const next = state.update({
      effects: setHighlight.of({ from: 0, to: DOC.length - 1, stateId: "cut", id: "new" }),
    }).state;
    expect(mark(next, field)).toEqual([`cut:${DOC.slice(0, DOC.length - 1)}`]);
  });

  it("leaves a mark that merely touches the boundary alone", () => {
    const { field, state } = stateWith([{ from: 0, to: 16, stateId: "good", id: "m1" }]);
    const next = state.update({
      effects: setHighlight.of({ from: 16, to: 30, stateId: "tweak", id: "m2" }),
    }).state;
    // Sliced from the document rather than written out, so the test is about
    // the boundary rule and not about counting characters by hand.
    expect(mark(next, field)).toEqual(["good:Alpha paragraph.", `tweak:${DOC.slice(16, 30)}`]);
  });

  it("does not disturb marks nowhere near it", () => {
    const { field, state } = stateWith([
      { from: 0, to: 16, stateId: "good", id: "a" },
      { from: at("Gamma"), to: at("Gamma") + 16, stateId: "unsure", id: "b" },
    ]);
    const next = state.update({
      effects: setHighlight.of({ from: at("Beta"), to: at("Beta") + 15, stateId: "tweak", id: "c" }),
    }).state;
    expect(mark(next, field)).toEqual([
      "good:Alpha paragraph.",
      "tweak:Beta paragraph.",
      "unsure:Gamma paragraph.",
    ]);
  });
});

describe("marks and edits", () => {
  it("follows the words when text above is deleted", () => {
    const { field, state } = stateWith([{ from: at("Gamma"), to: at("Gamma") + 16, stateId: "good", id: "m1" }]);
    const next = state.update({ changes: { from: 0, to: 18 } }).state;
    const doc = next.doc.toString();
    expect(mark(next, field, doc)).toEqual(["good:Gamma paragraph."]);
  });

  it("goes with its passage when that passage is cut out", () => {
    const { field, state } = stateWith([
      { from: 0, to: 16, stateId: "good", id: "keep" },
      { from: at("Beta"), to: at("Beta") + 15, stateId: "cut", id: "goes" },
    ]);
    const next = state.update({ changes: { from: at("Beta"), to: at("Beta") + 15 } }).state;
    const doc = next.doc.toString();
    expect(mark(next, field, doc)).toEqual(["good:Alpha paragraph."]);
  });

  it("never reports a mark outside the document", () => {
    const { field, state } = stateWith([{ from: at("Gamma"), to: at("Gamma") + 16, stateId: "good", id: "m1" }]);
    const next = state.update({ changes: { from: 20, to: DOC.length } }).state;
    for (const h of marks(next, field)) {
      expect(h.from).toBeGreaterThanOrEqual(0);
      expect(h.to).toBeLessThanOrEqual(next.doc.length);
      expect(h.to).toBeGreaterThan(h.from);
    }
  });
});

describe("clearing marks", () => {
  it("wipes everything when a different file is loaded", () => {
    const { field, state } = stateWith([
      { from: 0, to: 16, stateId: "good", id: "a" },
      { from: at("Beta"), to: at("Beta") + 15, stateId: "tweak", id: "b" },
    ]);
    const next = state.update({ effects: clearHighlights.of(null) }).state;
    expect(marks(next, field)).toEqual([]);
  });

  it("removes exactly one chunk and nothing else", () => {
    const { field, state } = stateWith([
      { from: 0, to: 16, stateId: "good", id: "a" },
      { from: at("Beta"), to: at("Beta") + 15, stateId: "tweak", id: "b" },
      { from: at("Gamma"), to: at("Gamma") + 16, stateId: "unsure", id: "c" },
    ]);
    const next = state.update({ effects: clearHighlightById.of("b") }).state;
    expect(mark(next, field)).toEqual(["good:Alpha paragraph.", "unsure:Gamma paragraph."]);
  });
});
