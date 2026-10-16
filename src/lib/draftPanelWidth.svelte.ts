const KEY = "mari-draft-panel-width";

/**
 * How wide the drafting panel is. Worth remembering rather than resetting each
 * time: comparing two wordings side by side wants room, and whoever widened it
 * once will want it wide next time too.
 */

export const DRAFT_PANEL_MIN_WIDTH = 320;
const DEFAULT_WIDTH = 525;

/** Leaves a usable strip of prose behind it, however wide the window is. */
export function maxDraftPanelWidth(): number {
  if (typeof window === "undefined") return 900;
  return Math.max(DRAFT_PANEL_MIN_WIDTH, window.innerWidth - 240);
}

function clamp(value: number): number {
  return Math.min(maxDraftPanelWidth(), Math.max(DRAFT_PANEL_MIN_WIDTH, Math.round(value)));
}

function initial(): number {
  if (typeof localStorage === "undefined") return DEFAULT_WIDTH;
  const stored = Number(localStorage.getItem(KEY));
  return Number.isFinite(stored) && stored > 0 ? clamp(stored) : DEFAULT_WIDTH;
}

class DraftPanelWidthStore {
  current = $state<number>(initial());

  /** Live while dragging — deliberately not written to storage per pixel. */
  set(value: number) {
    this.current = clamp(value);
  }

  reset() {
    this.current = DEFAULT_WIDTH;
    this.persist();
  }

  /** Called once when the drag ends. */
  persist() {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, String(this.current));
  }
}

export const draftPanelWidth = new DraftPanelWidthStore();
