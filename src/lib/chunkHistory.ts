/**
 * A chunk's replaced wordings. Versions live inside the `.mari` file (see
 * mariBundle) — this module is only the shape they take.
 */
export interface ChunkVersion {
  id: string;
  text: string;
  createdAt: string; // ISO timestamp
  // "draft" = a Replace from the draft panel (has text worth diffing against
  // the next version). "moved" = a Reposition move — text is preserved for
  // reference but there's nothing to diff, since nothing was rewritten.
  kind: "draft" | "moved";
}
