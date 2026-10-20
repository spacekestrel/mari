/**
 * A chunk's replaced wordings. Versions live inside the `.mari` file (see
 * mariBundle). This module is only the shape they take.
 */
export interface ChunkVersion {
  id: string;
  text: string;
  createdAt: string; // ISO timestamp
  // "draft" = a Replace from the draft panel (has text worth diffing against
  // the next version). "moved" = a Reposition move: text is preserved for
  // reference but there's nothing to diff, since nothing was rewritten.
  kind: "draft" | "moved";
  /**
   * The mark the passage was carrying when this wording was retired: what the
   * writer thought was wrong with it at the time.
   *
   * Optional because versions written before this existed don't carry one, and
   * because restoring an old wording to a passage with no mark left on it has
   * nothing to record. Those simply show no colour.
   */
  stateId?: string;
}
