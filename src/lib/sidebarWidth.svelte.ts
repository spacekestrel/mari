const KEY = "mari-sidebar-width";

export const SIDEBAR_MIN_WIDTH = 160;
export const SIDEBAR_MAX_WIDTH = 520;
const DEFAULT_WIDTH = 240;

function clamp(value: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(value)));
}

function initial(): number {
  if (typeof localStorage === "undefined") return DEFAULT_WIDTH;
  const stored = Number(localStorage.getItem(KEY));
  return Number.isFinite(stored) && stored > 0 ? clamp(stored) : DEFAULT_WIDTH;
}

class SidebarWidthStore {
  current = $state<number>(initial());

  /** Live update while dragging — deliberately not persisted on every pixel. */
  set(value: number) {
    this.current = clamp(value);
  }

  /** Called once when the drag ends, so localStorage isn't written per mousemove. */
  persist() {
    if (typeof localStorage !== "undefined") localStorage.setItem(KEY, String(this.current));
  }
}

export const sidebarWidth = new SidebarWidthStore();
