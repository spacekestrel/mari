import { describe, expect, it } from "vitest";
import { EditorState, type StateCommand } from "@codemirror/state";
import { history, isolateHistory, redo, undo } from "@codemirror/commands";
import {
  clearHighlightById,
  clearHighlights,
  createHighlightField,
  highlightsFollowUndo,
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

/**
 * Cutting marked paragraphs and pressing Ctrl+Z used to bring the words back
 * bare: the marks were gone, and with them the only way to reach each
 * passage's notes and earlier wordings. These run the real undo history.
 */
describe("marks survive undo", () => {
  function editor(initial: StoredHighlight[]) {
    const field = createHighlightField(initial);
    return {
      field,
      state: EditorState.create({
        doc: DOC,
        extensions: [field, history(), highlightsFollowUndo(field)],
      }),
    };
  }

  /** Reads against whatever the document says now, not what it said to begin with. */
  const show = (state: EditorState, field: ReturnType<typeof createHighlightField>) =>
    readHighlights(state.field(field), state.doc.length).map(
      (h) => `${h.stateId}:${state.doc.sliceString(h.from, h.to)}`,
    );

  /** Runs a command the way a keypress would, and hands back the new state. */
  function run(state: EditorState, command: StateCommand): EditorState {
    let next = state;
    command({ state, dispatch: (tr) => (next = tr.state) });
    return next;
  }

  const threeMarks: StoredHighlight[] = [
    { from: at("Alpha"), to: at("Alpha") + 16, stateId: "good", id: "m1" },
    { from: at("Beta"), to: at("Beta") + 15, stateId: "rewrite", id: "m2" },
    { from: at("Gamma"), to: at("Gamma") + 16, stateId: "cut", id: "m3" },
  ];

  it("brings a deleted paragraph's mark back with the words", () => {
    const { field, state } = editor(threeMarks);
    const cut = state.update({ changes: { from: at("Beta"), to: at("Beta") + 15 } }).state;
    expect(show(cut, field)).toEqual(["good:Alpha paragraph.", "cut:Gamma paragraph."]);

    const back = run(cut, undo);
    expect(back.doc.toString()).toBe(DOC);
    expect(show(back, field)).toEqual([
      "good:Alpha paragraph.",
      "rewrite:Beta paragraph.",
      "cut:Gamma paragraph.",
    ]);
  });

  it("brings back every mark when the whole chapter goes at once", () => {
    const { field, state } = editor(threeMarks);
    const cut = state.update({ changes: { from: 0, to: DOC.length } }).state;
    expect(show(cut, field)).toEqual([]);

    const back = run(cut, undo);
    expect(show(back, field)).toEqual([
      "good:Alpha paragraph.",
      "rewrite:Beta paragraph.",
      "cut:Gamma paragraph.",
    ]);
  });

  it("keeps each mark's own identity, so its notes and drafts still belong to it", () => {
    const { field, state } = editor(threeMarks);
    const cut = state.update({ changes: { from: 0, to: DOC.length } }).state;
    const back = run(cut, undo);
    expect(readHighlights(back.field(field), back.doc.length).map((h) => h.id)).toEqual([
      "m1",
      "m2",
      "m3",
    ]);
  });

  it("takes them away again on redo", () => {
    const { field, state } = editor(threeMarks);
    const cut = state.update({ changes: { from: at("Beta"), to: at("Beta") + 15 } }).state;
    const forward = run(run(cut, undo), redo);
    expect(show(forward, field)).toEqual(["good:Alpha paragraph.", "cut:Gamma paragraph."]);
  });

  it("walks back through several cuts one at a time", () => {
    const { field, state } = editor(threeMarks);
    let edited = state.update({ changes: { from: at("Gamma"), to: at("Gamma") + 16 } }).state;
    // Far enough apart in the history to be two separate presses.
    edited = edited.update({
      changes: { from: at("Beta"), to: at("Beta") + 15 },
      annotations: isolateHistory.of("before"),
    }).state;
    expect(show(edited, field)).toEqual(["good:Alpha paragraph."]);

    const once = run(edited, undo);
    expect(show(once, field)).toEqual(["good:Alpha paragraph.", "rewrite:Beta paragraph."]);

    const twice = run(once, undo);
    expect(show(twice, field)).toEqual([
      "good:Alpha paragraph.",
      "rewrite:Beta paragraph.",
      "cut:Gamma paragraph.",
    ]);
  });

  it("leaves one mark on an undone replacement, never two", () => {
    const { field, state } = editor(threeMarks);
    const replaced = state.update({
      changes: { from: at("Beta"), to: at("Beta") + 15, insert: "Something else entirely." },
    }).state;
    const back = run(replaced, undo);

    expect(readHighlights(back.field(field), back.doc.length).filter((h) => h.id === "m2")).toHaveLength(1);
    expect(show(back, field)).toContain("rewrite:Beta paragraph.");
  });

  it("does not double up a mark that was only clipped at one end", () => {
    const { field, state } = editor(threeMarks);
    // Takes the back half of Beta's mark, leaving the front half standing.
    const clipped = state.update({ changes: { from: at("Beta") + 5, to: at("Beta") + 15 } }).state;
    const back = run(clipped, undo);

    expect(readHighlights(back.field(field), back.doc.length).filter((h) => h.id === "m2")).toHaveLength(1);
    expect(back.doc.toString()).toBe(DOC);
  });

  it("leaves marking a passage outside the undo history, as it always was", () => {
    const { field, state } = editor([]);
    const marked = state.update({
      effects: setHighlight.of({ from: at("Beta"), to: at("Beta") + 15, stateId: "tweak", id: "m9" }),
    }).state;
    const typed = marked.update({ changes: { from: 0, insert: "New. " } }).state;

    // One undo takes back the typing. The mark stays, since it is not an edit,
    // and pressing the same key again is how it is cleared.
    const back = run(typed, undo);
    expect(back.doc.toString()).toBe(DOC);
    expect(readHighlights(back.field(field), back.doc.length).map((h) => h.id)).toEqual(["m9"]);
  });
});
