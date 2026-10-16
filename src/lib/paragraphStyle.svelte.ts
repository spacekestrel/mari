/**
 * How paragraphs are laid out on screen.
 *
 * `block` is the web convention: a blank line between paragraphs, no indent.
 * `book` is how a novel is typeset: no gap, and each paragraph after the first
 * begins with an indent.
 *
 * Display only. The blank lines between paragraphs are real characters in the
 * file and stay exactly where they are; book style just draws them closed up.
 * Nothing here changes a single byte of anyone's manuscript.
 */

export type ParagraphStyle = "block" | "book";

const STORAGE_KEY = "mari-paragraph-style";

function initial(): ParagraphStyle {
  if (typeof localStorage === "undefined") return "block";
  return localStorage.getItem(STORAGE_KEY) === "book" ? "book" : "block";
}

class ParagraphStyleStore {
  current = $state<ParagraphStyle>(initial());

  toggle() {
    this.current = this.current === "book" ? "block" : "book";
    if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, this.current);
  }
}

export const paragraphStyle = new ParagraphStyleStore();
