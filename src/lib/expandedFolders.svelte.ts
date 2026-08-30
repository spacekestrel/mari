const KEY = "mari-expanded-folders";

/**
 * Kept out of the tree rows themselves so it survives a restart: which folders
 * you had open is part of where you were working, like the file itself. A row
 * only exists while it's on screen, so it can't remember anything.
 */

/**
 * Enough for a deeply nested project, bounded so years of opened folders can't
 * grow without limit. Oldest go first.
 */
const MAX_REMEMBERED = 200;

function initial(): string[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((p): p is string => typeof p === "string") : [];
  } catch {
    // Deliberately silent: a corrupt entry only means the tree opens collapsed.
    return [];
  }
}

class ExpandedFolders {
  /** In the order they were opened, so the oldest can be dropped first. */
  private paths = $state<string[]>(initial());

  isExpanded(path: string): boolean {
    return this.paths.includes(path);
  }

  set(path: string, expanded: boolean) {
    const without = this.paths.filter((p) => p !== path);
    this.paths = expanded ? [...without, path].slice(-MAX_REMEMBERED) : without;
    this.persist();
  }

  toggle(path: string) {
    this.set(path, !this.isExpanded(path));
  }

  /**
   * Re-files a moved folder and everything under it, so a tree that was open
   * before a drag is still open after it.
   */
  rename(from: string, to: string) {
    const prefix = from.endsWith("/") ? from : `${from}/`;
    this.paths = this.paths.map((p) =>
      p === from || p.startsWith(prefix) ? to + p.slice(from.length) : p,
    );
    this.persist();
  }

  private persist() {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(KEY, JSON.stringify(this.paths));
  }
}

export const expandedFolders = new ExpandedFolders();
