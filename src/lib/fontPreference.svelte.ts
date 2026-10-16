import { FONT_OPTIONS, DEFAULT_FONT_ID, type FontOption } from "./fonts";

const KEY = "mari-font";

function initial(): FontOption {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
  return FONT_OPTIONS.find((f) => f.id === stored) ?? FONT_OPTIONS.find((f) => f.id === DEFAULT_FONT_ID)!;
}

function apply(font: FontOption) {
  document.documentElement.style.setProperty("--font-prose", font.family);
  document.documentElement.style.setProperty("--font-prose-weight", font.weight);
}

class FontPreferenceStore {
  current = $state<FontOption>(initial());

  constructor() {
    if (typeof document !== "undefined") apply(this.current);
  }

  /** Applies immediately to whatever's open now, and persists for every file opened after. */
  select(id: string) {
    const font = FONT_OPTIONS.find((f) => f.id === id);
    if (!font) return;
    this.current = font;
    localStorage.setItem(KEY, id);
    apply(font);
  }
}

export const fontPreference = new FontPreferenceStore();
