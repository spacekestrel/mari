import { describe, expect, it } from "vitest";
import {
  DRAFT_GROUP_DELAY_MS,
  DRAFT_MAX_STEPS,
  canRedoDraft,
  canUndoDraft,
  createDraftHistory,
  recordDraftEdit,
  redoDraft,
  undoDraft,
  type DraftHistory,
} from "./draftHistory";

/**
 * The drafting box is where a rewrite is written, and the manuscript isn't
 * touched until Replace. So the only thing that can be lost in there is the
 * draft itself, and Ctrl+Z is the one thing standing between a writer and a
 * paragraph they just typed over. These tests are about where the steps fall:
 * a step per word, never a step per letter, and never one that swallows work
 * the writer can't get back.
 */

const start = (text: string): DraftHistory =>
  createDraftHistory({ text, from: text.length, to: text.length });

/** Types `text` one character at a time, a tick apart, as a writer would. */
function type(history: DraftHistory, text: string, startingAt = 0): DraftHistory {
  let at = startingAt;
  for (const char of text) {
    at += 50;
    const next = history.present.text + char;
    history = recordDraftEdit(history, { text: next, from: next.length, to: next.length }, at);
  }
  return history;
}

describe("stepping back through typing", () => {
  it("undoes the last word, not the last letter", () => {
    const typed = type(start("The room was "), "cold");
    const back = undoDraft(typed);
    expect(back?.present.text).toBe("The room was ");
  });

  it("walks back one word per press", () => {
    let history = type(start(""), "the quiet room");

    history = undoDraft(history)!;
    expect(history.present.text).toBe("the quiet ");

    history = undoDraft(history)!;
    expect(history.present.text).toBe("the ");

    history = undoDraft(history)!;
    expect(history.present.text).toBe("");
  });

  it("starts a new step after a pause, so thinking time leaves a mark", () => {
    let history = type(start(""), "cold");
    // Long enough to count as having stopped.
    const later = 50 * 4 + DRAFT_GROUP_DELAY_MS + 1;
    history = recordDraftEdit(history, { text: "colde", from: 5, to: 5 }, later);

    expect(undoDraft(history)?.present.text).toBe("cold");
  });

  it("keeps a pasted run as its own step", () => {
    let history = type(start(""), "She said ");
    // Arrives whole rather than a letter at a time: a paste, not typing.
    history = recordDraftEdit(history, { text: "She said nothing at all", from: 23, to: 23 }, 500);

    expect(undoDraft(history)?.present.text).toBe("She said ");
  });

  it("does not let deleting join the typing before it", () => {
    let history = type(start(""), "word");
    history = recordDraftEdit(history, { text: "wor", from: 3, to: 3 }, 250);

    expect(undoDraft(history)?.present.text).toBe("word");
  });

  it("groups a run of deletes, so backspacing is one step", () => {
    let history = start("the quiet room");
    let at = 0;
    for (const text of ["the quiet roo", "the quiet ro", "the quiet r", "the quiet "]) {
      at += 50;
      history = recordDraftEdit(history, { text, from: text.length, to: text.length }, at);
    }

    expect(undoDraft(history)?.present.text).toBe("the quiet room");
  });

  it("treats typing over a selection as its own step", () => {
    const history = recordDraftEdit(start("the quiet room"), { text: "the loud room", from: 8, to: 8 }, 100);
    expect(undoDraft(history)?.present.text).toBe("the quiet room");
  });
});

describe("putting the caret back", () => {
  it("lands the caret where it stood before the undone words", () => {
    const typed = type(start("The room was "), "cold");
    const back = undoDraft(typed);
    expect(back?.present.from).toBe("The room was ".length);
    expect(back?.present.to).toBe("The room was ".length);
  });

  it("does not count moving the caret as a step", () => {
    const typed = type(start(""), "cold");
    const moved = recordDraftEdit(typed, { text: "cold", from: 0, to: 4 }, 9_999);

    expect(moved.past).toEqual(typed.past);
    expect(moved.present.from).toBe(0);
    expect(moved.present.to).toBe(4);
  });
});

describe("going forward again", () => {
  it("redoes what was undone", () => {
    const typed = type(start("The room was "), "cold");
    const back = undoDraft(typed)!;
    expect(redoDraft(back)?.present.text).toBe("The room was cold");
  });

  it("survives being walked all the way back and all the way forward", () => {
    let history = type(start(""), "the quiet room");
    const whole = history.present.text;

    while (canUndoDraft(history)) history = undoDraft(history)!;
    expect(history.present.text).toBe("");

    while (canRedoDraft(history)) history = redoDraft(history)!;
    expect(history.present.text).toBe(whole);
  });

  it("drops the undone branch once the writer types instead", () => {
    const typed = type(start(""), "the quiet room");
    const back = undoDraft(typed)!;
    const carriedOn = recordDraftEdit(back, { text: "the quiet dark", from: 14, to: 14 }, 9_999);

    expect(canRedoDraft(carriedOn)).toBe(false);
    expect(redoDraft(carriedOn)).toBeNull();
  });

  it("does not join the step that was just undone", () => {
    // Undo, then type immediately: close enough in time to have joined, and
    // it must not, or the step just recovered would be overwritten.
    const typed = type(start(""), "cold");
    const back = undoDraft(typed)!;
    const typedAgain = recordDraftEdit(back, { text: "w", from: 1, to: 1 }, 250);

    expect(undoDraft(typedAgain)?.present.text).toBe("");
  });
});

describe("the ends of the trail", () => {
  it("has nothing to undo when nothing has been written", () => {
    const fresh = start("an untouched draft");
    expect(canUndoDraft(fresh)).toBe(false);
    expect(undoDraft(fresh)).toBeNull();
  });

  it("has nothing to redo until something is undone", () => {
    const typed = type(start(""), "cold");
    expect(canRedoDraft(typed)).toBe(false);
    expect(redoDraft(typed)).toBeNull();
  });

  it("keeps the text the box opened with as the last step back", () => {
    let history = type(start("the original wording"), " plus more");
    while (canUndoDraft(history)) history = undoDraft(history)!;
    expect(history.present.text).toBe("the original wording");
  });

  it("stops growing at the ceiling, dropping the oldest steps", () => {
    let history = start("");
    // Each a second apart, so every one is its own step.
    for (let i = 1; i <= DRAFT_MAX_STEPS + 50; i += 1) {
      const text = "x".repeat(i);
      history = recordDraftEdit(history, { text, from: i, to: i }, i * 1000);
    }

    expect(history.past).toHaveLength(DRAFT_MAX_STEPS);
  });

  it("never reports a step that isn't there", () => {
    let history = type(start(""), "a few words here");
    for (let i = 0; i < 100; i += 1) history = undoDraft(history) ?? history;
    expect(history.present.text).toBe("");
    expect(undoDraft(history)).toBeNull();
  });
});
