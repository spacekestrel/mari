export interface HighlightState {
  id: string;
  label: string;
  // Solid color, used for the menu swatch.
  solid: string;
  // Translucent color, used for the applied highlight background.
  rgba: string;
  // What the chunk action icon does for a range marked with this state:
  // "draft" — opens the draft/compare workflow; this state means "I want to
  // change this text." "reposition" — opens move-placement mode instead of
  // drafting. "terminal" — the mark means a decision was already made
  // (keep as-is, or remove), so no *new* draft can start — but if the chunk
  // already has history from before, it stays viewable.
  chunkAction: "draft" | "reposition" | "terminal";
}

/**
 * Old state ids that have since been renamed, mapped to their replacement.
 * Sidecar files written before a rename still carry the old id, and an id that
 * matches no state renders as an invisible, inert mark — so loading migrates
 * them rather than silently dropping the user's work.
 */
const RENAMED_STATE_IDS: Record<string, string> = {
  keep: "good",
};

export function migrateStateId(stateId: string): string {
  return RENAMED_STATE_IDS[stateId] ?? stateId;
}

export const HIGHLIGHT_STATES: HighlightState[] = [
  // The top of the scale is deliberately a positive verdict rather than a
  // merely-acceptable one ("Keep it"), so there's somewhere to record the
  // passages that actually landed. "OK for now" covers fine-but-not-special.
  { id: "good", label: "Good", solid: "#5CB85C", rgba: "rgba(92, 184, 92, 0.18)", chunkAction: "terminal" },
  { id: "ok-for-now", label: "OK for now", solid: "#5B9BD5", rgba: "rgba(91, 155, 213, 0.16)", chunkAction: "terminal" },
  { id: "tweak", label: "Tweak", solid: "#F2C94C", rgba: "rgba(242, 201, 76, 0.22)", chunkAction: "draft" },
  { id: "reposition", label: "Reposition", solid: "#26C6DA", rgba: "rgba(38, 198, 218, 0.20)", chunkAction: "reposition" },
  { id: "rewrite", label: "Rewrite", solid: "#F2994A", rgba: "rgba(242, 153, 74, 0.22)", chunkAction: "draft" },
  { id: "expand", label: "Expand", solid: "#9B7EDE", rgba: "rgba(155, 126, 222, 0.18)", chunkAction: "draft" },
  { id: "cut", label: "Cut", solid: "#EB5757", rgba: "rgba(235, 87, 87, 0.18)", chunkAction: "terminal" },
  { id: "unsure", label: "Unsure", solid: "#8A8F98", rgba: "rgba(138, 143, 152, 0.15)", chunkAction: "draft" },
];
