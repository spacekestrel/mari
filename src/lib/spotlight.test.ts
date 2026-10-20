import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { dimRanges, setSpotlight, spotlightField, spotlightPassage } from "./spotlight";

/**
 * The passage being rewritten is the one thing on screen that must stay
 * readable. Every rule here is about not dimming it, and about not dimming the
 * whole chapter by accident when there is no passage to dim around.
 */

const CHAPTER = "Alpha paragraph.\n\nBeta paragraph here.\n\nGamma paragraph.";
const at = (needle: string) => CHAPTER.indexOf(needle);
const LENGTH = CHAPTER.length;

describe("what gets held back", () => {
  it("dims the prose either side of the passage", () => {
    const beta = { from: at("Beta"), to: at("Beta") + 20 };
    expect(dimRanges(LENGTH, beta)).toEqual([
      { from: 0, to: beta.from },
      { from: beta.to, to: LENGTH },
    ]);
  });

  it("dims only below, for a passage at the top of the chapter", () => {
    expect(dimRanges(LENGTH, { from: 0, to: 16 })).toEqual([{ from: 16, to: LENGTH }]);
  });

  it("dims only above, for a passage at the end", () => {
    const from = at("Gamma");
    expect(dimRanges(LENGTH, { from, to: LENGTH })).toEqual([{ from: 0, to: from }]);
  });

  it("dims nothing when the passage is the whole chapter", () => {
    expect(dimRanges(LENGTH, { from: 0, to: LENGTH })).toEqual([]);
  });

  it("dims nothing when no passage is being rewritten", () => {
    expect(dimRanges(LENGTH, null)).toEqual([]);
  });

  it("dims nothing for a passage with nothing in it", () => {
    // The dangerous case: treated as a range, this would fade the whole chapter.
    expect(dimRanges(LENGTH, { from: 10, to: 10 })).toEqual([]);
    expect(dimRanges(LENGTH, { from: 20, to: 5 })).toEqual([]);
  });

  it("stays inside the chapter when handed a passage that runs past the end", () => {
    const ranges = dimRanges(LENGTH, { from: at("Gamma"), to: LENGTH + 500 });
    expect(ranges).toEqual([{ from: 0, to: at("Gamma") }]);
  });
});

describe("the passage as the chapter is edited behind the panel", () => {
  const beta = { from: at("Beta"), to: at("Beta") + 20 };
  const editor = () => EditorState.create({ doc: CHAPTER, extensions: [spotlightPassage()] });

  it("remembers which passage is being rewritten", () => {
    const open = editor().update({ effects: setSpotlight.of(beta) }).state;
    expect(open.field(spotlightField)).toEqual(beta);
  });

  it("keeps the passage lit where it has moved to", () => {
    const open = editor().update({ effects: setSpotlight.of(beta) }).state;

    // A longer first paragraph pushes the passage down the chapter.
    const added = " Much longer now.";
    const typed = open.update({ changes: { from: 16, insert: added } }).state;

    expect(typed.field(spotlightField)).toEqual({
      from: beta.from + added.length,
      to: beta.to + added.length,
    });
    expect(dimRanges(typed.doc.length, typed.field(spotlightField))).toEqual([
      { from: 0, to: beta.from + added.length },
      { from: beta.to + added.length, to: typed.doc.length },
    ]);
  });

  it("grows with the passage when it is edited in the chapter behind the panel", () => {
    const open = editor().update({ effects: setSpotlight.of(beta) }).state;
    const word = "very ";
    const typed = open.update({ changes: { from: beta.from + 5, insert: word } }).state;

    expect(typed.field(spotlightField)).toEqual({ from: beta.from, to: beta.to + word.length });
  });

  it("leaves words typed at the start outside the passage", () => {
    const open = editor().update({ effects: setSpotlight.of(beta) }).state;
    const added = "New sentence. ";
    const typed = open.update({ changes: { from: beta.from, insert: added } }).state;

    expect(typed.field(spotlightField)).toEqual({
      from: beta.from + added.length,
      to: beta.to + added.length,
    });
  });

  it("leaves words typed at the end outside the passage", () => {
    const open = editor().update({ effects: setSpotlight.of(beta) }).state;
    const typed = open.update({ changes: { from: beta.to, insert: " And more." } }).state;

    expect(typed.field(spotlightField)).toEqual(beta);
  });

  it("lets the whole chapter back up when the panel closes", () => {
    const open = editor().update({ effects: setSpotlight.of(beta) }).state;
    const closed = open.update({ effects: setSpotlight.of(null) }).state;

    expect(closed.field(spotlightField)).toBeNull();
    expect(dimRanges(closed.doc.length, closed.field(spotlightField))).toEqual([]);
  });
});
