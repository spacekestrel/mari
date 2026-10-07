import { describe, expect, it } from "vitest";
import { parser, Strikethrough } from "@lezer/markdown";
import { Text } from "@codemirror/state";
import { spaceBelongsAt, hiddenCharacters, deletionBelongsAt } from "./emphasisGuard";

/** The same grammar the editor runs. */
const md = parser.configure([{ remove: ["SetextHeading"] }, Strikethrough]);

const hiddenIn = (text: string) => hiddenCharacters(md.parse(text), Text.of(text.split("\n")));

/** Types `what` at `caret` the way the filter would, and returns the result. */
function type(text: string, caret: number, what: string): string {
  const at = spaceBelongsAt(md.parse(text), caret) ?? caret;
  return text.slice(0, at) + what + text.slice(at);
}

/** Presses backspace at `caret` the way the filter would. */
function backspace(text: string, caret: number): string {
  const moved = deletionBelongsAt(hiddenIn(text), caret - 1, caret, text.length, caret);
  const { from, to } = moved ?? { from: caret - 1, to: caret };
  return text.slice(0, from) + text.slice(to);
}

/** Presses delete at `caret`. */
function forwardDelete(text: string, caret: number): string {
  const moved = deletionBelongsAt(hiddenIn(text), caret, caret + 1, text.length, caret);
  const { from, to } = moved ?? { from: caret, to: caret + 1 };
  return text.slice(0, from) + text.slice(to);
}

describe("spaces and line breaks", () => {
  it("puts a space after the closing marker, not inside it", () => {
    expect(type("one *two* three", 8, " ")).toBe("one *two*  three");
  });

  it("does the same for a line break, which arrives by another route", () => {
    // This is the one that split the emphasis across two lines.
    expect(type("one *two*", 8, "\n")).toBe("one *two*\n");
  });

  it("clears every layer of nested emphasis", () => {
    expect(type("say ***both*** now", 11, "\n")).toBe("say ***both***\n now");
  });

  it("puts one typed just inside an opening marker in front of it", () => {
    expect(type("one *two* three", 5, " ")).toBe("one  *two* three");
  });

  it("leaves a space in open prose alone", () => {
    expect(type("one two three", 7, " ")).toBe("one two three".slice(0, 7) + " " + "one two three".slice(7));
  });

  it("does not jump a space into the next word", () => {
    // The marker in front opens the emphasis of the word after it.
    expect(type("word *next*", 5, " ")).toBe("word  *next*");
  });
});

describe("deleting", () => {
  it("takes the last letter, not the marker standing invisibly after it", () => {
    // Caret is past the closing marker; the writer is looking at "two".
    expect(backspace("one *two* three", 9)).toBe("one *tw* three");
  });

  it("reaches through several markers at once", () => {
    expect(backspace("say ***both*** now", 14)).toBe("say ***bot*** now");
  });

  it("takes the first letter when deleting forwards onto an opening marker", () => {
    expect(forwardDelete("one *two* three", 4)).toBe("one *wo* three");
  });

  it("leaves an ordinary deletion exactly where it was", () => {
    expect(backspace("one two three", 7)).toBe("one tw three");
    expect(forwardDelete("one two three", 4)).toBe("one wo three");
  });

  it("refuses when there is nothing visible left to take", () => {
    // Markers at the very start with no letter before them.
    expect(deletionBelongsAt(hiddenIn("*a*"), 0, 1, 3, 1)).toBeNull();
  });

  it("leaves a deletion that already covers real text alone", () => {
    expect(deletionBelongsAt(hiddenIn("one *two* three"), 5, 8, 15, 8)).toBeNull();
  });

  it("does nothing for an empty range", () => {
    expect(deletionBelongsAt(hiddenIn("one *two*"), 4, 4, 9, 4)).toBeNull();
  });

  it("stays out of it when the caret sits at neither end", () => {
    // Not a single keypress, so not this rule's business.
    expect(deletionBelongsAt(hiddenIn("one *two* three"), 8, 9, 15, 2)).toBeNull();
  });
});

describe("what counts as hidden", () => {
  it("knows the markers and not the words", () => {
    const hidden = hiddenIn("one *two* three");
    expect(hidden(4)).toBe(true); // the opening *
    expect(hidden(8)).toBe(true); // the closing *
    expect(hidden(5)).toBe(false); // "t"
    expect(hidden(0)).toBe(false); // "o"
  });

  it("counts the space swallowed after a heading's hash", () => {
    const hidden = hiddenIn("# Title");
    expect(hidden(0)).toBe(true);
    expect(hidden(1)).toBe(true);
    expect(hidden(2)).toBe(false);
  });
});
