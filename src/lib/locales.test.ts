import { describe, expect, it } from "vitest";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { HIGHLIGHT_STATES } from "./highlightStates";

type Node = Record<string, unknown>;

/** Every leaf in a dictionary, as a dotted path plus what kind of thing it is. */
function leaves(node: Node, prefix = ""): Map<string, string> {
  const found = new Map<string, string>();
  for (const [key, value] of Object.entries(node)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null) {
      for (const [inner, kind] of leaves(value as Node, path)) found.set(inner, kind);
    } else {
      found.set(path, typeof value);
    }
  }
  return found;
}

describe("locales", () => {
  const english = leaves(en as unknown as Node);
  const russian = leaves(ru as unknown as Node);

  it("translates every English string", () => {
    const missing = [...english.keys()].filter((key) => !russian.has(key));
    expect(missing).toEqual([]);
  });

  it("has no Russian strings the app never asks for", () => {
    const extra = [...russian.keys()].filter((key) => !english.has(key));
    expect(extra).toEqual([]);
  });

  it("keeps plain strings plain and formatters callable", () => {
    for (const [key, kind] of english) {
      expect(`${key}: ${russian.get(key)}`).toBe(`${key}: ${kind}`);
    }
  });

  it("leaves nothing still in English", () => {
    const untranslated = [...english.entries()]
      .filter(([key, kind]) => kind === "string" && key !== "tag")
      // Names of things that are the same word in both languages.
      .filter(([key]) => key !== "markdown.title")
      .filter(([key]) => {
        const path = key.split(".");
        const read = (dict: unknown) => path.reduce<any>((node, step) => node?.[step], dict);
        return read(en) === read(ru);
      })
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });

  it("names every highlight in both languages", () => {
    for (const state of HIGHLIGHT_STATES) {
      expect(en.highlights[state.id], `English name for ${state.id}`).toBeTruthy();
      expect(ru.highlights[state.id], `Russian name for ${state.id}`).toBeTruthy();
    }
  });

  it("counts in Russian the way Russian counts", () => {
    // 1 слово, 2 слова, 5 слов — and the teens break the pattern.
    expect(ru.document.words(1)).toBe("1 слово");
    expect(ru.document.words(3)).toBe("3 слова");
    expect(ru.document.words(5)).toBe("5 слов");
    expect(ru.document.words(11)).toBe("11 слов");
    expect(ru.document.words(21)).toBe("21 слово");
    expect(ru.document.words(112)).toBe("112 слов");
    expect(ru.document.characters(2)).toBe("2 символа");
    expect(ru.document.characters(27)).toBe("27 символов");
  });
});
