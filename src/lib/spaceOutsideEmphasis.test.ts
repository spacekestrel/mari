import { describe, expect, it } from "vitest";
import { parser } from "@lezer/markdown";
import { Strikethrough } from "@lezer/markdown";
import { spaceBelongsAt } from "./spaceOutsideEmphasis";

/** The same grammar the editor runs, strikethrough included. */
const md = parser.configure([Strikethrough]);

/** Types a space at `caret` the way the editor would, and returns the result. */
function typeSpace(text: string, caret: number): string {
  const at = spaceBelongsAt(md.parse(text), caret) ?? caret;
  return `${text.slice(0, at)} ${text.slice(at)}`;
}

describe("spaceBelongsAt", () => {
  it("moves a space out past a closing marker", () => {
    // Caret at the end of the word, which is inside `*brown*`.
    expect(spaceBelongsAt(md.parse("The quick *brown* fox"), 16)).toBe(17);
    // The space lands after the marker rather than in front of it.
    expect(typeSpace("*brown*", 6)).toBe("*brown* ");
  });

  it("does the same for bold and strikethrough", () => {
    expect(spaceBelongsAt(md.parse("a **loud** word"), 8)).toBe(10);
    expect(spaceBelongsAt(md.parse("a ~~cut~~ word"), 7)).toBe(9);
  });

  it("clears every layer when emphasis is nested", () => {
    // `***both***` closes with two markers; stopping after one still leaves
    // the space inside the italic, and the asterisks would still appear.
    expect(spaceBelongsAt(md.parse("say ***both*** now"), 11)).toBe(14);
  });

  it("moves a space back out past an opening marker", () => {
    // `* brown*` is not italic either, so the space goes before the marker.
    expect(spaceBelongsAt(md.parse("The quick *brown* fox"), 11)).toBe(10);
    expect(spaceBelongsAt(md.parse("a **loud** word"), 4)).toBe(2);
  });

  it("leaves a space that is already outside alone", () => {
    expect(spaceBelongsAt(md.parse("The quick *brown* fox"), 17)).toBeNull();
    expect(spaceBelongsAt(md.parse("The quick *brown* fox"), 10)).toBeNull();
    expect(spaceBelongsAt(md.parse("plain text here"), 5)).toBeNull();
    expect(spaceBelongsAt(md.parse(""), 0)).toBeNull();
  });

  it("leaves a space in the middle of an emphasised phrase alone", () => {
    // Nothing is at risk here; the markers are nowhere near the caret.
    expect(spaceBelongsAt(md.parse("*two words here*"), 9)).toBeNull();
  });

  it("does not jump the space into the next word", () => {
    // The `*` in front of the caret opens the emphasis of the word after it.
    // Moving the space past that would put it inside `*next*`.
    const text = "word *next*";
    expect(spaceBelongsAt(md.parse(text), 5)).toBeNull();
  });

  it("keeps the emphasis working, which is the whole point", () => {
    const shape = (s: string) => {
      const names: string[] = [];
      md.parse(s).iterate({
        enter: (n) => {
          names.push(n.name);
        },
      });
      return names;
    };
    // Before: a space typed at the caret broke it outright.
    expect(shape("The quick *brown * fox")).not.toContain("Emphasis");
    // After: the space lands outside and the italic survives.
    expect(shape(typeSpace("The quick *brown* fox", 16))).toContain("Emphasis");
  });
});
