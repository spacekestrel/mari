import { describe, it, expect } from "vitest";
import {
  toggleInline,
  isInlineActive,
  toggleBlock,
  isBlockActive,
  type Inline,
  type Block,
} from "./markdownFormat";

/** Applies an edit and marks the resulting selection with | for readability. */
function apply(text: string, from: number, to: number, kind: Inline) {
  const e = toggleInline(text, from, to, kind);
  if (!e) return null;
  const next = text.slice(0, e.from) + e.insert + text.slice(e.to);
  return {
    text: next,
    selected: next.slice(e.selectFrom, e.selectTo),
  };
}

/** Offsets of the first occurrence of a phrase, for readable tests. */
function at(text: string, phrase: string): [number, number] {
  const i = text.indexOf(phrase);
  if (i < 0) throw new Error(`not found: ${phrase}`);
  return [i, i + phrase.length];
}

describe("adding emphasis", () => {
  it("wraps the selection in bold", () => {
    const t = "she was very tired";
    const r = apply(t, ...at(t, "very tired"), "bold")!;
    expect(r.text).toBe("she was **very tired**");
    expect(r.selected).toBe("very tired");
  });

  it("wraps the selection in italic with a single asterisk", () => {
    const t = "she was never tired";
    expect(apply(t, ...at(t, "never"), "italic")!.text).toBe("she was *never* tired");
  });

  it("wraps the selection in strikethrough", () => {
    const t = "cut this line";
    expect(apply(t, ...at(t, "this"), "strike")!.text).toBe("cut ~~this~~ line");
  });

  it("keeps a trailing space outside the markers", () => {
    // `**word **` renders as literal asterisks, not bold.
    const t = "down the rabbit hole";
    const r = apply(t, ...at(t, "rabbit "), "bold")!;
    expect(r.text).toBe("down the **rabbit** hole");
    expect(r.selected).toBe("rabbit");
  });

  it("keeps a leading space outside the markers", () => {
    const t = "down the rabbit hole";
    expect(apply(t, ...at(t, " rabbit"), "italic")!.text).toBe("down the *rabbit* hole");
  });

  it("does nothing for a selection of only whitespace", () => {
    expect(toggleInline("a   b", 1, 4, "bold")).toBeNull();
  });

  it("does nothing when nothing is selected", () => {
    expect(toggleInline("hello", 2, 2, "bold")).toBeNull();
  });
});

describe("removing emphasis", () => {
  it("unwraps when the markers sit outside the selection", () => {
    const t = "she was **very tired**";
    const r = apply(t, ...at(t, "very tired"), "bold")!;
    expect(r.text).toBe("she was very tired");
    expect(r.selected).toBe("very tired");
  });

  it("unwraps when the markers were caught in the selection", () => {
    const t = "she was **very tired**";
    const r = apply(t, ...at(t, "**very tired**"), "bold")!;
    expect(r.text).toBe("she was very tired");
    expect(r.selected).toBe("very tired");
  });

  it("unwraps italic", () => {
    const t = "she was *never* tired";
    expect(apply(t, ...at(t, "never"), "italic")!.text).toBe("she was never tired");
  });

  it("unwraps strikethrough", () => {
    const t = "cut ~~this~~ line";
    expect(apply(t, ...at(t, "this"), "strike")!.text).toBe("cut this line");
  });
});

describe("telling italic from bold", () => {
  it("does not report italic active inside a bold span", () => {
    // Both markers are asterisks; a naive check sees `*` on each side here.
    const t = "she was **very** tired";
    expect(isInlineActive(t, ...at(t, "very"), "italic")).toBe(false);
    expect(isInlineActive(t, ...at(t, "very"), "bold")).toBe(true);
  });

  it("italicising inside bold nests rather than stripping an asterisk", () => {
    const t = "she was **very** tired";
    const r = apply(t, ...at(t, "very"), "italic")!;
    expect(r.text).toBe("she was ***very*** tired");
  });

  it("reports italic active when it really is italic", () => {
    const t = "she was *very* tired";
    expect(isInlineActive(t, ...at(t, "very"), "italic")).toBe(true);
    expect(isInlineActive(t, ...at(t, "very"), "bold")).toBe(false);
  });

  it("is inactive on plain text", () => {
    const t = "she was very tired";
    for (const k of ["bold", "italic", "strike"] as Inline[]) {
      expect(isInlineActive(t, ...at(t, "very"), k)).toBe(false);
    }
  });
});

describe("round trips", () => {
  it("on then off returns the original for every kind", () => {
    const t = "Alice was beginning to get very tired";
    for (const k of ["bold", "italic", "strike"] as Inline[]) {
      const [f, s] = at(t, "very tired");
      const on = toggleInline(t, f, s, k)!;
      const mid = t.slice(0, on.from) + on.insert + t.slice(on.to);
      const off = toggleInline(mid, on.selectFrom, on.selectTo, k)!;
      expect(mid.slice(0, off.from) + off.insert + mid.slice(off.to)).toBe(t);
    }
  });
});

describe("headings and quotes", () => {
  const line = (text: string, at: number, kind: Block) => {
    const e = toggleBlock(text, at, kind);
    return text.slice(0, e.from) + e.insert + text.slice(e.to);
  };

  it("adds a heading to the line", () => {
    expect(line("Chapter One", 3, "heading1")).toBe("# Chapter One");
    expect(line("Chapter One", 3, "heading2")).toBe("## Chapter One");
  });

  it("adds a quote marker", () => {
    expect(line("Curiouser and curiouser", 3, "quote")).toBe("> Curiouser and curiouser");
  });

  it("removes the marker when pressed again", () => {
    expect(line("# Chapter One", 5, "heading1")).toBe("Chapter One");
    expect(line("> Quoted", 4, "quote")).toBe("Quoted");
  });

  it("swaps one marker for another rather than stacking them", () => {
    expect(line("## Chapter One", 6, "heading1")).toBe("# Chapter One");
    expect(line("> Quoted", 4, "heading1")).toBe("# Quoted");
  });

  it("only touches the line the cursor is on", () => {
    const t = "First line\nSecond line\nThird line";
    expect(line(t, t.indexOf("Second"), "heading1")).toBe("First line\n# Second line\nThird line");
  });

  it("reports which marker a line carries", () => {
    const t = "# Chapter One\nplain\n> quoted";
    expect(isBlockActive(t, 3, "heading1")).toBe(true);
    expect(isBlockActive(t, 3, "heading2")).toBe(false);
    expect(isBlockActive(t, t.indexOf("plain"), "heading1")).toBe(false);
    expect(isBlockActive(t, t.indexOf("quoted"), "quote")).toBe(true);
  });

  it("keeps the caret on the same word when the marker is added", () => {
    const t = "Chapter One";
    const e = toggleBlock(t, t.indexOf("One"), "heading1");
    const next = t.slice(0, e.from) + e.insert + t.slice(e.to);
    // Still sitting just before "One", not pushed two characters into it.
    expect(next.slice(e.selectFrom)).toBe("One");
  });

  it("keeps the caret on the same word when the marker is removed", () => {
    const t = "# Chapter One";
    const e = toggleBlock(t, t.indexOf("One"), "heading1");
    const next = t.slice(0, e.from) + e.insert + t.slice(e.to);
    expect(next.slice(e.selectFrom)).toBe("One");
  });
});

describe("bold and italic stacked together", () => {
  const roundTrip = (text: string, phrase: string, kind: Inline) => {
    const i = text.indexOf(phrase);
    const e = toggleInline(text, i, i + phrase.length, kind)!;
    return text.slice(0, e.from) + e.insert + text.slice(e.to);
  };

  it("reports both active on a triple marker", () => {
    const t = "she was ***very*** tired";
    expect(isInlineActive(t, ...at(t, "very"), "italic")).toBe(true);
    expect(isInlineActive(t, ...at(t, "very"), "bold")).toBe(true);
  });

  it("italic off a triple marker leaves bold behind", () => {
    // Was adding a fourth asterisk to each side instead of removing one.
    expect(roundTrip("she was ***very*** tired", "very", "italic")).toBe("she was **very** tired");
  });

  it("bold off a triple marker leaves italic behind", () => {
    expect(roundTrip("she was ***very*** tired", "very", "bold")).toBe("she was *very* tired");
  });

  it("italic on top of bold gives all three", () => {
    expect(roundTrip("she was **very** tired", "very", "italic")).toBe("she was ***very*** tired");
  });

  it("bold on top of italic gives all three", () => {
    expect(roundTrip("she was *very* tired", "very", "bold")).toBe("she was ***very*** tired");
  });

  it("never leaves an even run that renders as literal asterisks", () => {
    let t = "she was very tired";
    for (const k of ["bold", "italic", "bold", "italic"] as Inline[]) t = roundTrip(t, "very", k);
    expect(t).toBe("she was very tired");
  });
});
