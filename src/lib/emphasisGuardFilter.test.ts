import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { markdown } from "@codemirror/lang-markdown";
import { Strikethrough } from "@lezer/markdown";
import { syntaxTree } from "@codemirror/language";
import { keepEmphasisWhole } from "./emphasisGuard";

/**
 * The filter itself, driven the way the editor drives it.
 *
 * The pure rules were already tested, and they were right. What was wrong was
 * the wiring: Enter reaches the document labelled "input" rather than
 * "input.type", so the filter never looked at it. Nothing testing the rules in
 * isolation could have caught that, and a browser test that pressed Enter from
 * a position needing no correction passed while the filter did nothing.
 */
function editor(doc: string, caret = 0) {
  const state = EditorState.create({
    doc,
    selection: { anchor: caret },
    extensions: [markdown({ extensions: [Strikethrough] }), keepEmphasisWhole()],
  });
  // Force the parse, so the filter has a tree to read.
  syntaxTree(state);
  return state;
}

/** Backspace with the caret at `caret`. */
function backspace(doc: string, caret: number): string {
  return editor(doc, caret).update({
    changes: { from: caret - 1, to: caret },
    selection: { anchor: caret - 1 },
    userEvent: "delete",
  }).state.doc.toString();
}

/** Whether the text still reads as italic to the parser. */
function italic(text: string): boolean {
  let found = false;
  syntaxTree(editor(text)).iterate({
    enter: (n) => {
      if (n.name === "Emphasis") found = true;
    },
  });
  return found;
}

/** Dispatches one change the way a key would, and returns the resulting text. */
function press(doc: string, at: number, insert: string, userEvent: string): string {
  const state = editor(doc);
  return state.update({
    changes: { from: at, insert },
    selection: { anchor: at + insert.length },
    userEvent,
  }).state.doc.toString();
}

describe("the filter, as the editor calls it", () => {
  // Caret between the last letter and the closing marker, which is where
  // formatting a word leaves it and where clicking at the end of one lands.
  const insideTheMarker = 8;

  it("moves a line break out of the emphasis", () => {
    // Enter is labelled "input", not "input.type".
    expect(press("one *two* three", insideTheMarker, "\n", "input")).toBe("one *two*\n three");
  });

  it("moves a typed space out of the emphasis", () => {
    expect(press("one *two* three", insideTheMarker, " ", "input.type")).toBe("one *two*  three");
  });

  it("leaves a typed letter inside, where it was aimed", () => {
    expect(press("one *two* three", insideTheMarker, "x", "input.type")).toBe("one *twox* three");
  });

  it("leaves pasted text exactly where it was dropped", () => {
    // Paste is its own decision, deliberately not inheriting this rule.
    expect(press("one *two* three", insideTheMarker, " and", "input.paste")).toBe(
      "one *two and* three",
    );
  });

  it("leaves Mari's own edits alone", () => {
    // No user event at all: the formatting buttons, the draft panel, the
    // drawer, loading a chapter.
    const state = editor("one *two* three");
    const after = state.update({ changes: { from: insideTheMarker, insert: "\n" } }).state;
    expect(after.doc.toString()).toBe("one *two\n* three");
  });

  it("takes the markers with the word when a line break replaces it", () => {
    // Formatting a word leaves it selected. Pressing Enter then replaces it,
    // and the markers, which the writer cannot see, were left behind holding
    // nothing: the line read "*" and "*".
    const state = editor("*ddfdfgf*");
    const after = state.update({
      changes: { from: 1, to: 8, insert: "\n" },
      userEvent: "input",
    }).state;
    expect(after.doc.toString()).toBe("\n");
  });

  it("keeps the markers when a letter replaces the word, which stays italic", () => {
    const state = editor("*ddfdfgf*");
    const after = state.update({
      changes: { from: 1, to: 8, insert: "x" },
      userEvent: "input.type",
    }).state;
    expect(after.doc.toString()).toBe("*x*");
  });

  it("keeps the word italic wherever a letter is deleted from it", () => {
    // Backspace at every position in and around `*two*`, including the two
    // where the character behind the caret is a marker nobody can see.
    for (let caret = 5; caret <= 10; caret++) {
      const after = backspace("one *two* three", caret);
      // The emphasis surviving is the whole claim: an orphaned marker would
      // stop it parsing, which is exactly what put stars in the prose.
      expect(italic(after), `caret ${caret} left ${JSON.stringify(after)}`).toBe(true);
    }
  });

  it("takes the markers when the last letter of an italic word goes", () => {
    // A one-letter italic word. Deleting the letter left `**` behind.
    expect(backspace("one *a* two", 6)).toBe("one  two");
    // And the same with the caret the other side of the closing marker.
    expect(backspace("one *a* two", 7)).toBe("one  two");
  });

  it("keeps the emphasis parseable afterwards, which is the whole point", () => {
    const text = press("one *two* three", insideTheMarker, "\n", "input");
    const names: string[] = [];
    syntaxTree(editor(text)).iterate({ enter: (n) => void names.push(n.name) });
    expect(names).toContain("Emphasis");
  });
});
