/**
 * Renaming a file or folder in the tree.
 *
 * Kept away from the components so the awkward parts can be tested on plain
 * strings: what counts as a usable name, and which part of one a writer
 * actually wants selected when the box opens.
 */

/** Characters no file system will take, plus the separators. */
const FORBIDDEN = /[\\/:*?"<>|]/;

export type RenameProblem = "empty" | "unchanged" | "forbidden" | "reserved" | "taken";

/**
 * Whether a new name can be used, or why it can't.
 *
 * `siblings` are the other names already in that folder. A name differing only
 * in case is refused: it works on Linux and quietly overwrites on macOS and
 * Windows, and a rename that destroys a chapter on one machine and not another
 * is the worst kind of bug to ship.
 */
export function renameProblem(
  current: string,
  next: string,
  siblings: string[] = [],
): RenameProblem | null {
  const name = next.trim();
  if (!name) return "empty";
  if (name === current) return "unchanged";
  if (FORBIDDEN.test(name)) return "forbidden";
  // "." and ".." address a folder rather than name one.
  if (name === "." || name === "..") return "reserved";
  const lower = name.toLowerCase();
  if (siblings.some((s) => s !== current && s.toLowerCase() === lower)) return "taken";
  return null;
}

/**
 * The part of a name to select when the box opens: the name without its
 * extension, which is the part being changed. Renaming a chapter should not
 * mean retyping `.mari`, nor risk losing it to a stray keystroke.
 *
 * A leading dot is part of the name rather than an extension, so a dotfile is
 * selected whole.
 */
export function selectionForRename(name: string): { from: number; to: number } {
  const dot = name.lastIndexOf(".");
  return { from: 0, to: dot > 0 ? dot : name.length };
}

/** The path a renamed entry ends up at. */
export function renamedPath(path: string, next: string): string {
  const cut = path.lastIndexOf("/");
  return cut < 0 ? next : `${path.slice(0, cut)}/${next}`;
}
