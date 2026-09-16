import { en, type Strings } from "./locales/en";
import { ru } from "./locales/ru";

export type LocaleId = "en" | "ru";

export interface LocaleOption {
  id: LocaleId;
  /** Named in its own language — that's the one word a reader is sure to know. */
  label: string;
}

export const LOCALE_OPTIONS: LocaleOption[] = [
  { id: "en", label: "English" },
  { id: "ru", label: "Русский" },
];

const DICTIONARIES: Record<LocaleId, Strings> = { en, ru };

const KEY = "mari-language";

function isLocale(value: string | null): value is LocaleId {
  return value === "en" || value === "ru";
}

/**
 * The language chosen last time, or the one the system asks for, or English.
 *
 * A Russian-speaking writer shouldn't have to find the setting before the app
 * speaks to them, so the browser's own language is honoured on first run.
 */
function initial(): LocaleId {
  if (typeof localStorage !== "undefined") {
    const stored = localStorage.getItem(KEY);
    if (isLocale(stored)) return stored;
  }
  if (typeof navigator !== "undefined") {
    for (const tag of navigator.languages ?? [navigator.language]) {
      const base = tag?.split("-")[0];
      if (isLocale(base)) return base;
    }
  }
  return "en";
}

class I18nStore {
  current = $state<LocaleId>(initial());

  constructor() {
    if (typeof document !== "undefined") document.documentElement.lang = this.current;
  }

  /** Every string in the app, in the language now in force. */
  get t(): Strings {
    return DICTIONARIES[this.current];
  }

  /** For toLocaleDateString and friends, which want a BCP 47 tag. */
  get tag(): string {
    return this.t.tag;
  }

  select(id: string) {
    if (!isLocale(id) || id === this.current) return;
    this.current = id;
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, id);
    if (typeof document !== "undefined") document.documentElement.lang = id;
  }
}

export const i18n = new I18nStore();

/**
 * The same strings for code that runs outside a component and can't hold a
 * reactive reference — the CodeMirror extensions, mostly. Reads the current
 * language each time it's called, so anything built fresh gets it right.
 */
export function t(): Strings {
  return i18n.t;
}

/**
 * A highlight's name in the current language.
 *
 * Files store the state's id, never its label, so translating these is safe:
 * a chapter marked "Tweak" in English opens as «Подправить» in Russian and
 * saves back under the same id. An unrecognised id keeps its built-in label
 * rather than showing a blank swatch.
 */
export function highlightLabel(stateId: string, fallback: string): string {
  return i18n.t.highlights[stateId] ?? fallback;
}
