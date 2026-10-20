import { describe, expect, it } from "vitest";
import { EditorState, Text, type StateCommand } from "@codemirror/state";
import { history, redo, undo } from "@codemirror/commands";
import type { ChunkVersion } from "./chunkHistory";
import type { StoredHighlight } from "./highlightStore";
import { createHighlightField } from "./highlightField";
import {
  activeWorkedField,
  bracketLines,
  bracketSources,
  bracketsFollowUndo,
  clearWorked,
  clearWorkedById,
  coversWholeLine,
  createWorkedField,
  inferWorked,
  readWorked,
  setActiveWorked,
  setWorked,
  workedAt,
  workedById,
  type StoredWorked,
} from "./workedMarks";

/**
 * A bracket in the margin is the only thing saying where a reworked passage
 * was, once the highlight that asked for the rewrite has gone. If it drifts
 * off the passage, or disappears, the earlier wordings are still in the file
 * but there is no way left to reach them.
 */

const CHAPTER = "Alpha paragraph.\n\nBeta paragraph here.\n\nGamma paragraph.";
const doc = Text.of(CHAPTER.split("\n"));
const at = (needle: string) => CHAPTER.indexOf(needle);
const spanOf = (needle: string): [number, number] => [at(needle), at(needle) + needle.length];

describe("which passages earn a bracket", () => {
  it("marks a passage that covers a whole paragraph", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    expect(coversWholeLine(doc, from, to)).toBe(true);
  });

  it("marks a passage running across several paragraphs", () => {
    expect(coversWholeLine(doc, at("Alpha"), at("Gamma") + 5)).toBe(true);
  });

  it("refuses a few words from the middle of a paragraph", () => {
    const [from, to] = spanOf("paragraph here");
    expect(coversWholeLine(doc, from, to)).toBe(false);
  });

  it("refuses a passage that stops short of the end of its line", () => {
    expect(coversWholeLine(doc, at("Beta"), at("Beta") + 4)).toBe(false);
  });

  it("refuses an empty passage", () => {
    expect(coversWholeLine(doc, at("Beta"), at("Beta"))).toBe(false);
  });

  it("counts a passage reaching exactly to the end of the chapter", () => {
    expect(coversWholeLine(doc, at("Gamma"), CHAPTER.length)).toBe(true);
  });
});

describe("which lines the bracket is drawn beside", () => {
  const whole = (worked: StoredWorked[]) => bracketLines(doc, worked, 0, CHAPTER.length);

  it("puts both arms on a passage that is one paragraph", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    expect(whole([{ id: "a", from, to }])).toEqual([{ from, first: true, last: true, id: "a", active: false }]);
  });

  it("puts the arms at the two ends of a passage spanning paragraphs", () => {
    const lines = whole([{ id: "a", from: at("Alpha"), to: at("Beta") + "Beta paragraph here.".length }]);
    expect(lines).toHaveLength(3); // Alpha, the blank line between, Beta
    expect(lines[0]).toEqual({ from: at("Alpha"), first: true, last: false, id: "a", active: false });
    expect(lines[1].first).toBe(false);
    expect(lines[1].last).toBe(false);
    expect(lines[2]).toEqual({ from: at("Beta"), first: false, last: true, id: "a", active: false });
  });

  it("does not run onto the line after a passage that ends at a line break", () => {
    // `to` lands on the newline itself, one past the last word.
    const lines = whole([{ id: "a", from: at("Alpha"), to: at("Alpha") + "Alpha paragraph.".length }]);
    expect(lines).toEqual([{ from: at("Alpha"), first: true, last: true, id: "a", active: false }]);
  });

  it("leaves out lines that are scrolled off screen", () => {
    const worked = [{ id: "a", from: at("Alpha"), to: CHAPTER.length }];
    const onlyLastLine = bracketLines(doc, worked, at("Gamma"), CHAPTER.length);
    expect(onlyLastLine).toEqual([{ from: at("Gamma"), first: false, last: true, id: "a", active: false }]);
  });

  it("gives a line both arms where two reworked passages meet on it", () => {
    const beta = spanOf("Beta paragraph here.");
    const lines = whole([
      { id: "a", from: at("Alpha"), to: beta[1] },
      { id: "b", from: beta[0], to: CHAPTER.length },
    ]);
    const shared = lines.find((line) => line.from === beta[0]);
    expect(shared).toEqual({ from: beta[0], first: true, last: true, id: "a", active: false });
  });

  it("draws nothing for a passage edited away to nothing", () => {
    expect(whole([{ id: "a", from: 10, to: 10 }])).toEqual([]);
  });

  it("lights up only the passage being looked at", () => {
    const beta = spanOf("Beta paragraph here.");
    const gamma = spanOf("Gamma paragraph.");
    const lines = bracketLines(
      doc,
      [
        { id: "a", from: beta[0], to: beta[1] },
        { id: "b", from: gamma[0], to: gamma[1] },
      ],
      0,
      CHAPTER.length,
      "b",
    );
    expect(lines.map((line) => [line.id, line.active])).toEqual([
      ["a", false],
      ["b", true],
    ]);
  });

  it("lights nothing when no passage is being looked at", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    expect(bracketLines(doc, [{ id: "a", from, to }], 0, CHAPTER.length, null)[0].active).toBe(false);
  });

  it("lights every line of a passage, not just the first", () => {
    const lines = bracketLines(
      doc,
      [{ id: "a", from: at("Alpha"), to: at("Beta") + "Beta paragraph here.".length }],
      0,
      CHAPTER.length,
      "a",
    );
    expect(lines.every((line) => line.active)).toBe(true);
  });

  it("gives a shared line to the lit passage, so the click lands on that one", () => {
    const beta = spanOf("Beta paragraph here.");
    const lines = bracketLines(
      doc,
      [
        { id: "a", from: at("Alpha"), to: beta[1] },
        { id: "b", from: beta[0], to: CHAPTER.length },
      ],
      0,
      CHAPTER.length,
      "b",
    );
    const shared = lines.find((line) => line.from === beta[0]);
    expect(shared?.id).toBe("b");
    expect(shared?.active).toBe(true);
  });

  it("names every line's passage, so a click in the margin knows what it hit", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const lines = whole([{ id: "passage-1", from, to }]);
    expect(lines.map((line) => line.id)).toEqual(["passage-1"]);
  });

  it("returns the lines in the order they appear in the chapter", () => {
    const lines = whole([
      { id: "b", from: at("Gamma"), to: CHAPTER.length },
      { id: "a", from: at("Alpha"), to: at("Alpha") + 16 },
    ]);
    expect(lines.map((line) => line.from)).toEqual([at("Alpha"), at("Gamma")]);
  });
});

/**
 * Chapters saved before brackets existed. Most reworked passages in them are
 * genuinely unplaceable: the highlight that held the spot was cleared when the
 * work was done. The ones where a mark was left behind are not, and those are
 * what this recovers. Nothing here may invent a bracket: one standing against
 * prose that was never reworked is worse than none, because it would be trusted.
 */
describe("recovering brackets from an older file", () => {
  const beta = spanOf("Beta paragraph here.");
  const reworked = (kind: "draft" | "moved" = "draft") => ({
    "mark-1": [{ id: "v1", text: "what it used to say", createdAt: "2026-01-01T00:00:00.000Z", kind }],
  });
  const markOn = (id: string, [from, to]: [number, number]) => [{ id, from, to, stateId: "tweak" }];

  it("places a bracket where a mark was left on a reworked passage", () => {
    expect(inferWorked(CHAPTER, markOn("mark-1", beta), reworked())).toEqual([
      { id: "mark-1", from: beta[0], to: beta[1] },
    ]);
  });

  it("invents nothing for a passage that was only ever highlighted", () => {
    expect(inferWorked(CHAPTER, markOn("mark-1", beta), {})).toEqual([]);
  });

  it("invents nothing when the chapter has no highlights left to go on", () => {
    expect(inferWorked(CHAPTER, [], reworked())).toEqual([]);
  });

  it("leaves a passage that was only moved, never rewritten", () => {
    expect(inferWorked(CHAPTER, markOn("mark-1", beta), reworked("moved"))).toEqual([]);
  });

  it("reads history written before moves existed as a rework", () => {
    const old = { "mark-1": [{ id: "v1", text: "older", createdAt: "" }] as ChunkVersion[] };
    expect(inferWorked(CHAPTER, markOn("mark-1", beta), old)).toHaveLength(1);
  });

  it("holds to the same whole-line rule as a fresh bracket", () => {
    const fragment = spanOf("paragraph here");
    expect(inferWorked(CHAPTER, markOn("mark-1", fragment), reworked())).toEqual([]);
  });

  it("ignores a mark pointing outside the chapter", () => {
    const beyond = [{ id: "mark-1", from: 9000, to: 9100, stateId: "tweak" }];
    expect(inferWorked(CHAPTER, beyond, reworked())).toEqual([]);
  });

  it("draws the recovered bracket on the passage it was reworked at", () => {
    // The whole chain an older chapter goes through on opening: what the file
    // says, what that implies, and where the bracket actually lands.
    const recovered = inferWorked(CHAPTER, markOn("mark-1", beta), reworked());
    const field = createWorkedField(recovered);
    const state = EditorState.create({ doc: CHAPTER, extensions: [field] });

    expect(bracketLines(state.doc, readWorked(state.field(field), state.doc.length), 0, CHAPTER.length)).toEqual([
      { from: beta[0], first: true, last: true, id: "mark-1", active: false },
    ]);
  });

  it("recovers each reworked passage once, across several marks", () => {
    const gamma = spanOf("Gamma paragraph.");
    const marks = [
      { id: "mark-1", from: beta[0], to: beta[1], stateId: "tweak" },
      { id: "mark-2", from: gamma[0], to: gamma[1], stateId: "unsure" },
    ];
    const history = { ...reworked(), "mark-2": reworked()["mark-1"] };
    expect(inferWorked(CHAPTER, marks, history).map((w) => w.id)).toEqual(["mark-1", "mark-2"]);
  });
});

/** A chapter in an editor, with the brackets its file came with. */
function openChapter(worked: StoredWorked[] = []) {
  const field = createWorkedField(worked);
  const state = EditorState.create({ doc: CHAPTER, extensions: [field] });
  return { field, state };
}

describe("brackets as the chapter is edited", () => {
  it("opens a file with the brackets it was saved with", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const { field, state } = openChapter([{ id: "a", from, to }]);
    expect(readWorked(state.field(field), state.doc.length)).toEqual([{ id: "a", from, to }]);
  });

  it("stays on its passage when prose above it is rewritten", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const { field, state } = openChapter([{ id: "a", from, to }]);

    // A longer first paragraph pushes everything below it down.
    const added = " Much longer now.";
    const next = state.update({
      changes: { from: at("Alpha") + 16, insert: added },
    }).state;

    expect(readWorked(next.field(field), next.doc.length)).toEqual([
      { id: "a", from: from + added.length, to: to + added.length },
    ]);
  });

  it("records a reworked passage", () => {
    const { field, state } = openChapter();
    const [from, to] = spanOf("Gamma paragraph.");
    const next = state.update({ effects: setWorked.of({ id: "a", from, to }) }).state;

    expect(readWorked(next.field(field), next.doc.length)).toEqual([{ id: "a", from, to }]);
  });

  it("moves a passage's bracket rather than stacking a second one on it", () => {
    const { field, state } = openChapter();
    const first = state.update({ effects: setWorked.of({ id: "a", from: 0, to: 16 }) }).state;
    const [from, to] = spanOf("Gamma paragraph.");
    const again = first.update({ effects: setWorked.of({ id: "a", from, to }) }).state;

    expect(readWorked(again.field(field), again.doc.length)).toEqual([{ id: "a", from, to }]);
  });

  it("drops a bracket whose passage was deleted outright", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const { field, state } = openChapter([{ id: "a", from, to }]);
    const next = state.update({ changes: { from, to, insert: "" } }).state;

    expect(readWorked(next.field(field), next.doc.length)).toEqual([]);
  });

  it("keeps the other brackets when one is dropped by id", () => {
    const beta = spanOf("Beta paragraph here.");
    const gamma = spanOf("Gamma paragraph.");
    const { field, state } = openChapter([
      { id: "a", from: beta[0], to: beta[1] },
      { id: "b", from: gamma[0], to: gamma[1] },
    ]);
    const next = state.update({ effects: clearWorkedById.of("a") }).state;

    expect(readWorked(next.field(field), next.doc.length)).toEqual([
      { id: "b", from: gamma[0], to: gamma[1] },
    ]);
  });

  it("wipes the lot when another file's content is swapped in", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const { field, state } = openChapter([{ id: "a", from, to }]);
    const next = state.update({ effects: clearWorked.of(null) }).state;

    expect(readWorked(next.field(field), next.doc.length)).toEqual([]);
  });
});

describe("finding the passage under the cursor", () => {
  it("names the passage the cursor is inside", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const { field, state } = openChapter([{ id: "a", from, to }]);
    expect(workedAt(state.field(field), from + 4)?.id).toBe("a");
  });

  it("finds nothing in prose that was never reworked", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const { field, state } = openChapter([{ id: "a", from, to }]);
    expect(workedAt(state.field(field), at("Gamma") + 2)).toBeNull();
  });

  it("finds a passage by name, for a click that landed on its bracket", () => {
    const beta = spanOf("Beta paragraph here.");
    const gamma = spanOf("Gamma paragraph.");
    const { field, state } = openChapter([
      { id: "a", from: beta[0], to: beta[1] },
      { id: "b", from: gamma[0], to: gamma[1] },
    ]);
    expect(workedById(state.field(field), state.doc.length, "b")).toEqual({
      id: "b",
      from: gamma[0],
      to: gamma[1],
    });
  });

  it("finds nothing for a name no passage carries", () => {
    const [from, to] = spanOf("Beta paragraph here.");
    const { field, state } = openChapter([{ id: "a", from, to }]);
    expect(workedById(state.field(field), state.doc.length, "gone")).toBeNull();
  });
});

describe("the bracket being looked at", () => {
  const [from, to] = spanOf("Beta paragraph here.");

  function withActive(id: string | null) {
    const field = createWorkedField([{ id: "a", from, to }]);
    const state = EditorState.create({ doc: CHAPTER, extensions: [field, activeWorkedField] });
    return id === null ? state : state.update({ effects: setActiveWorked.of(id) }).state;
  }

  it("starts with none lit", () => {
    expect(withActive(null).field(activeWorkedField)).toBeNull();
  });

  it("remembers which one is lit", () => {
    expect(withActive("a").field(activeWorkedField)).toBe("a");
  });

  it("puts it out again when the writer looks elsewhere", () => {
    const lit = withActive("a");
    expect(lit.update({ effects: setActiveWorked.of(null) }).state.field(activeWorkedField)).toBeNull();
  });

  it("keeps the lit one through an edit, so it doesn't flicker while typing", () => {
    const lit = withActive("a");
    const typed = lit.update({ changes: { from: 0, insert: "More. " } }).state;
    expect(typed.field(activeWorkedField)).toBe("a");
  });
});

/**
 * Brackets have the same exposure the marks had: delete the passage, undo, and
 * the bracket was gone even though the words came back. And a bracket must not
 * outlive the rework that earned it, since a margin claiming work that was
 * undone would send the writer looking for a wording that is already on the
 * page.
 */
describe("brackets survive undo", () => {
  function editor(initial: StoredWorked[]) {
    const field = createWorkedField(initial);
    return {
      field,
      state: EditorState.create({
        doc: CHAPTER,
        extensions: [field, history(), bracketsFollowUndo(field)],
      }),
    };
  }

  function run(state: EditorState, command: StateCommand): EditorState {
    let next = state;
    command({ state, dispatch: (tr) => (next = tr.state) });
    return next;
  }

  const read = (state: EditorState, field: ReturnType<typeof createWorkedField>) =>
    readWorked(state.field(field), state.doc.length);

  const beta = spanOf("Beta paragraph here.");

  it("brings a deleted passage's bracket back with the words", () => {
    const { field, state } = editor([{ id: "a", from: beta[0], to: beta[1] }]);
    const cut = state.update({ changes: { from: beta[0], to: beta[1] } }).state;
    expect(read(cut, field)).toEqual([]);

    const back = run(cut, undo);
    expect(back.doc.toString()).toBe(CHAPTER);
    expect(read(back, field)).toEqual([{ id: "a", from: beta[0], to: beta[1] }]);
  });

  it("brings back every bracket when the whole chapter goes at once", () => {
    const gamma = spanOf("Gamma paragraph.");
    const { field, state } = editor([
      { id: "a", from: beta[0], to: beta[1] },
      { id: "b", from: gamma[0], to: gamma[1] },
    ]);
    const cut = state.update({ changes: { from: 0, to: CHAPTER.length } }).state;
    expect(read(cut, field)).toEqual([]);

    expect(read(run(cut, undo), field).map((w) => w.id)).toEqual(["a", "b"]);
  });

  it("takes the bracket away again on redo", () => {
    const { field, state } = editor([{ id: "a", from: beta[0], to: beta[1] }]);
    const cut = state.update({ changes: { from: beta[0], to: beta[1] } }).state;
    expect(read(run(run(cut, undo), redo), field)).toEqual([]);
  });

  it("takes a new bracket off when the rework that earned it is undone", () => {
    // What a Replace dispatches: the words change and the bracket goes on, in
    // one transaction, so one undo reverses both.
    const { field, state } = editor([]);
    const reworked = state.update({
      changes: { from: beta[0], to: beta[1], insert: "A new wording." },
      effects: setWorked.of({ id: "a", from: beta[0], to: beta[0] + "A new wording.".length }),
    }).state;
    expect(read(reworked, field)).toHaveLength(1);

    const back = run(reworked, undo);
    expect(back.doc.toString()).toBe(CHAPTER);
    expect(read(back, field)).toEqual([]);
  });

  it("puts a second rework's bracket back where the first one stood", () => {
    const { field, state } = editor([{ id: "a", from: beta[0], to: beta[1] }]);
    const again = state.update({
      changes: { from: beta[0], to: beta[1], insert: "Reworked twice over." },
      effects: setWorked.of({ id: "a", from: beta[0], to: beta[0] + "Reworked twice over.".length }),
    }).state;

    const back = run(again, undo);
    expect(read(back, field)).toEqual([{ id: "a", from: beta[0], to: beta[1] }]);
  });

  it("leaves exactly one bracket per passage after an undo", () => {
    const { field, state } = editor([{ id: "a", from: beta[0], to: beta[1] }]);
    const cut = state.update({ changes: { from: beta[0], to: beta[1] } }).state;
    const back = run(cut, undo);
    expect(read(back, field).filter((w) => w.id === "a")).toHaveLength(1);
  });
});

/**
 * Every marked passage earns a bracket now, not only the reworked ones. The
 * two must not collide: a passage that is both should be one bracket wearing
 * its current colour, not two stacked in the margin.
 */
describe("which passages the margin shows", () => {
  const beta = spanOf("Beta paragraph here.");
  const gamma = spanOf("Gamma paragraph.");

  function chapter(marks: StoredHighlight[], worked: StoredWorked[]) {
    const workedField = createWorkedField(worked);
    const highlightField = createHighlightField(marks);
    const state = EditorState.create({
      doc: CHAPTER,
      extensions: [workedField, highlightField],
    });
    return bracketSources(state, workedField, highlightField);
  }

  it("gives a marked passage a bracket in its own colour", () => {
    const sources = chapter([{ from: beta[0], to: beta[1], stateId: "rewrite", id: "m1" }], []);
    expect(sources).toEqual([{ id: "m1", from: beta[0], to: beta[1], color: "#F2994A" }]);
  });

  it("still gives a reworked passage one, with no colour to show", () => {
    const sources = chapter([], [{ id: "w1", from: beta[0], to: beta[1] }]);
    expect(sources).toEqual([{ id: "w1", from: beta[0], to: beta[1] }]);
  });

  it("gives a passage that is both one bracket, in the colour it wears now", () => {
    const sources = chapter(
      [{ from: beta[0], to: beta[1], stateId: "good", id: "same" }],
      [{ id: "same", from: beta[0], to: beta[1] }],
    );
    expect(sources).toEqual([{ id: "same", from: beta[0], to: beta[1], color: "#5CB85C" }]);
  });

  it("holds marks to the same whole-line rule as reworked passages", () => {
    const fragment = spanOf("paragraph here");
    expect(chapter([{ from: fragment[0], to: fragment[1], stateId: "tweak", id: "m1" }], [])).toEqual([]);
  });

  it("colours a mark saved under its old name", () => {
    // "keep" was renamed to "good"; the colour should follow the rename.
    const sources = chapter([{ from: beta[0], to: beta[1], stateId: "keep", id: "m1" }], []);
    expect(sources[0].color).toBe("#5CB85C");
  });

  it("leaves a mark with an unknown name uncoloured rather than guessing", () => {
    const sources = chapter([{ from: beta[0], to: beta[1], stateId: "invented", id: "m1" }], []);
    expect(sources[0].color).toBeUndefined();
  });

  it("lists every marked and reworked passage in the chapter", () => {
    const sources = chapter(
      [{ from: beta[0], to: beta[1], stateId: "cut", id: "m1" }],
      [{ id: "w1", from: gamma[0], to: gamma[1] }],
    );
    expect(sources.map((s) => s.id).sort()).toEqual(["m1", "w1"]);
  });

  it("carries the colour down every line the bracket covers", () => {
    const lines = bracketLines(
      doc,
      [{ id: "m1", from: at("Alpha"), to: beta[1], color: "#F2994A" }],
      0,
      CHAPTER.length,
    );
    expect(lines.every((line) => line.color === "#F2994A")).toBe(true);
  });

  it("gives a shared line to the lit passage's colour", () => {
    const lines = bracketLines(
      doc,
      [
        { id: "a", from: at("Alpha"), to: beta[1], color: "#F2994A" },
        { id: "b", from: beta[0], to: CHAPTER.length, color: "#5CB85C" },
      ],
      0,
      CHAPTER.length,
      "b",
    );
    expect(lines.find((line) => line.from === beta[0])?.color).toBe("#5CB85C");
  });
});
