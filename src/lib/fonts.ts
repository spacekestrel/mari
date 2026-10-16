export interface FontOption {
  id: string;
  label: string;
  family: string;
  weight: string;
}

/**
 * Serifs that carry Chinese, so prose set in them reads as one typeface rather
 * than as Latin in the chosen font and Chinese in whatever the system grabs.
 * Appended to every family below: a Latin font is chosen first and wins for
 * Latin, and these only answer for characters it doesn't have.
 */
const CJK = '"Noto Serif CJK SC", "Source Han Serif SC", "Songti SC", SimSun, serif';

/** Five widely-loved serifs for long-form writing, each self-hosted via Fontsource. */
export const FONT_OPTIONS: FontOption[] = [
  { id: "literata", label: "Literata", family: `"Literata", Georgia, ${CJK}`, weight: "300" },
  { id: "lora", label: "Lora", family: `"Lora", Georgia, ${CJK}`, weight: "400" },
  { id: "merriweather", label: "Merriweather", family: `"Merriweather", Georgia, ${CJK}`, weight: "300" },
  { id: "eb-garamond", label: "EB Garamond", family: `"EB Garamond", Georgia, ${CJK}`, weight: "400" },
  { id: "source-serif", label: "Source Serif 4", family: `"Source Serif 4", Georgia, ${CJK}`, weight: "300" },
];

export const DEFAULT_FONT_ID = "literata";
