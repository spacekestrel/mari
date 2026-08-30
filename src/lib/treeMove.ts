import type { FsEntry } from "./platform";

/**
 * Deciding whether one thing in the tree can be dropped on another.
 *
 * Kept away from the drag handlers so the awkward cases can be tested on
 * plain paths: a folder cannot be dropped inside itself, and "inside itself"
 * includes every folder underneath it, however deep.
 */

/** True when `path` is the same as, or somewhere under, `ancestor`. */
export function isWithin(path: string, ancestor: string): boolean {
  if (path === ancestor) return true;
  const base = ancestor.endsWith("/") ? ancestor : `${ancestor}/`;
  return path.startsWith(base);
}

/** The folder a path currently sits in. */
export function parentPath(path: string): string {
  const cut = path.lastIndexOf("/");
  return cut <= 0 ? "" : path.slice(0, cut);
}

export function joinPath(dir: string, name: string): string {
  return dir.endsWith("/") ? `${dir}${name}` : `${dir}/${name}`;
}

/**
 * Whether dragging `source` onto `target` should do anything.
 *
 * Refuses the four cases that are either impossible or pointless: dropping
 * onto a file, onto itself, back where it already was, and — the one that
 * would actually destroy work — a folder into its own descendant, which would
 * leave it nowhere.
 */
export function canDrop(
  source: { path: string; kind: string },
  target: { path: string; kind: string },
): boolean {
  if (target.kind !== "directory") return false;
  if (source.path === target.path) return false;
  if (parentPath(source.path) === target.path) return false;
  if (source.kind === "directory" && isWithin(target.path, source.path)) return false;
  return true;
}

/**
 * Where a path ends up after its ancestor folder moves.
 *
 * Used to follow the open document and the notes kept against it: those are
 * filed by path, and a move that didn't update them would strand unsaved work
 * under a name nothing points at any more.
 */
export function pathAfterMove(path: string, movedFrom: string, movedTo: string): string {
  if (!isWithin(path, movedFrom)) return path;
  return movedTo + path.slice(movedFrom.length);
}

/** Where an entry lands when dropped into a folder. */
export function destinationFor(source: FsEntry, target: FsEntry): string {
  return joinPath(target.path, source.name);
}
