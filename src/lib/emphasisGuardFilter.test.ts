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

/** What the writer actually sees, with the markers painted over. */
function visibleText(text: string): string {
  const marks: { from: number; to: number }[] = [];
  syntaxTree(editor(text)).iterate({
    enter: (n) => {
      if (n.name === "EmphasisMark" || n.name === "StrikethroughMark") marks.push({ from: n.from, to: n.to });
    },
  });
  let seen = "";
  for (let i = 0; i < text.length; i++) {
    if (!marks.some((m) => i >= m.from && i < m.to)) seen += text[i];
  }
  return seen;
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

/**
 * Taking words out of the middle of an italic phrase.
 *
 * Reported four times over, each time as "it shows an asterisk". Deleting a
 * word from inside `*two three*` leaves a space against a marker, Markdown
 * stops reading it as italic, and both markers appear in the prose. Every case
 * below reproduced that before the markers were taught to close up.
 */
describe("deleting part of an italic phrase", () => {
  /** Deletes a range the way selecting it and pressing backspace does. */
  function cut(doc: string, from: number, to: number): { text: string; caret: number } {
    const after = editor(doc, to).update({
      changes: { from, to },
      selection: { anchor: from },
      userEvent: "delete",
    }).state;
    return { text: after.doc.toString(), caret: after.selection.main.head };
  }

  /** Backspace, n times over, from one caret. */
  function heldDown(doc: string, caret: number, times: number): string {
    let state = editor(doc, caret);
    for (let i = 0; i < times; i++) {
      const head = state.selection.main.head;
      state = state.update({
        changes: { from: head - 1, to: head },
        selection: { anchor: head - 1 },
        userEvent: "delete",
      }).state;
    }
    return state.doc.toString();
  }

  // "one *two three* four" — the closing marker is at 14.
  const phrase = "one *two three* four";

  it("stays italic when the last word goes", () => {
    const { text } = cut(phrase, 9, 14);
    expect(text).toBe("one *two*  four");
    expect(italic(text)).toBe(true);
  });

  it("stays italic when the first word goes", () => {
    const { text } = cut(phrase, 5, 8);
    expect(text).toBe("one  *three* four");
    expect(italic(text)).toBe(true);
  });

  it("stays italic through a held-down backspace", () => {
    const text = heldDown(phrase, 14, 5);
    expect(text).toBe("one *two*  four");
    expect(italic(text)).toBe(true);
  });

  it("keeps every character the writer could see", () => {
    // "one two three four" minus "three" is "one two  four" — two spaces,
    // because the writer deleted a word and not the spaces around it.
    expect(visibleText(cut(phrase, 9, 14).text)).toBe("one two  four");
    expect(visibleText(cut(phrase, 5, 8).text)).toBe("one  three four");
  });

  it("leaves the caret where the words were", () => {
    // Between the two spaces: where "three" had been.
    expect(cut(phrase, 9, 14).caret).toBe(10);
    expect(cut(phrase, 5, 8).caret).toBe(4);
  });

  it("takes the markers when no words are left", () => {
    expect(cut("a *b* c", 3, 4).text).toBe("a  c");
    expect(cut(phrase, 5, 14).text).toBe("one  four");
  });

  it("closes up the outer markers too, not just the inner ones", () => {
    // Bold and italic together. Closing only the inner pair would leave
    // "a ***b** * d" — the same bug one layer out.
    const { text } = cut("a ***b c*** d", 7, 8);
    expect(text).toBe("a ***b***  d");
    expect(italic(text)).toBe(true);
    expect(visibleText(text)).toBe("a b  d");
  });

  it("does the same for bold on its own", () => {
    expect(cut("a **b c** d", 7, 8).text).toBe("a **b**  d");
  });

  it("leaves alone a deletion that reaches a marker on purpose", () => {
    // Selecting the whole phrase, markers and all, is the writer taking the
    // emphasis off. Nothing here should put it back.
    expect(cut("one *two* three", 4, 9).text).toBe("one  three");
  });
});
