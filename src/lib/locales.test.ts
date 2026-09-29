import { describe, expect, it } from "vitest";
import { en } from "./locales/en";
import { ru } from "./locales/ru";
import { de } from "./locales/de";
import { es } from "./locales/es";
import { zh } from "./locales/zh";
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

/** Every translation, checked against English one at a time. */
const TRANSLATIONS = { ru, de, es, zh } as const;

/**
 * Words a language borrows whole, so being identical to the English is right
 * rather than a sign nobody translated it.
 */
const BORROWED = new Set(["Markdown", "Terminal", "Link", "Original", "Plan"]);

describe.each(Object.entries(TRANSLATIONS))("locale %s", (code, dictionary) => {
  const english = leaves(en as unknown as Node);
  const translated = leaves(dictionary as unknown as Node);

  it("translates every English string", () => {
    const missing = [...english.keys()].filter((key) => !translated.has(key));
    expect(missing).toEqual([]);
  });

  it("has no strings the app never asks for", () => {
    const extra = [...translated.keys()].filter((key) => !english.has(key));
    expect(extra).toEqual([]);
  });

  it("keeps plain strings plain and formatters callable", () => {
    for (const [key, kind] of english) {
      expect(`${key}: ${translated.get(key)}`).toBe(`${key}: ${kind}`);
    }
  });

  it("leaves nothing still in English", () => {
    const read = (dict: unknown, key: string) =>
      key.split(".").reduce<any>((node, step) => node?.[step], dict);
    const untranslated = [...english.entries()]
      .filter(([key, kind]) => kind === "string" && key !== "tag")
      .filter(([key]) => !BORROWED.has(read(en, key)))
      .filter(([key]) => read(en, key) === read(dictionary, key))
      .map(([key]) => key);
    expect(untranslated).toEqual([]);
  });

  it("names every highlight", () => {
    for (const state of HIGHLIGHT_STATES) {
      expect(en.highlights[state.id], `English name for ${state.id}`).toBeTruthy();
      expect(dictionary.highlights[state.id], `${code} name for ${state.id}`).toBeTruthy();
    }
  });

  it("counts without leaving a number bare", () => {
    for (const n of [0, 1, 2, 5, 11, 21, 112]) {
      expect(dictionary.document.words(n)).toContain(String(n));
      expect(dictionary.document.characters(n)).toContain(String(n));
    }
  });
});

describe("Russian counting", () => {
  it("counts the way Russian counts", () => {
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

describe("singular and plural", () => {
  it("is right in German and Spanish, which have both", () => {
    expect(de.document.words(1)).toBe("1 Wort");
    expect(de.document.words(2)).toBe("2 Wörter");
    expect(es.document.words(1)).toBe("1 palabra");
    expect(es.document.words(2)).toBe("2 palabras");
    expect(es.document.characters(1)).toBe("1 carácter");
    expect(es.document.characters(2)).toBe("2 caracteres");
  });

  it("does not invent one in Chinese, which has none", () => {
    expect(zh.document.words(1)).toBe("1 词");
    expect(zh.document.words(9)).toBe("9 词");
  });
});
