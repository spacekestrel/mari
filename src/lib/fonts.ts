export interface FontOption {
  id: string;
  label: string;
  family: string;
  weight: string;
}

/** Five widely-loved serifs for long-form writing, each self-hosted via Fontsource. */
export const FONT_OPTIONS: FontOption[] = [
  { id: "literata", label: "Literata", family: '"Literata", Georgia, serif', weight: "300" },
  { id: "lora", label: "Lora", family: '"Lora", Georgia, serif', weight: "400" },
  { id: "merriweather", label: "Merriweather", family: '"Merriweather", Georgia, serif', weight: "300" },
  { id: "eb-garamond", label: "EB Garamond", family: '"EB Garamond", Georgia, serif', weight: "400" },
  { id: "source-serif", label: "Source Serif 4", family: '"Source Serif 4", Georgia, serif', weight: "300" },
];

export const DEFAULT_FONT_ID = "literata";
