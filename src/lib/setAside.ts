/**
 * Deciding between a chapter's unsaved changes and the file on disk.
 *
 * Leaving a chapter with unsaved changes sets them aside under its path and
 * puts them back when you return. That is right while Mari is the only thing
 * touching the file, and wrong the moment something else does: pulling a newer
 * version of a chapter from another machine left the old unsaved copy showing,
 * with no sign that the file underneath had moved on.
 *
 * So work put aside records the state of the file it was based on. If the file
 * is still that one, the unsaved changes come back. If it isn't, the file wins
 * and the writer is told the copy was dropped rather than finding out by
 * saving over a newer chapter.
 */

/** Unsaved changes, and the file they were made against. */
export interface SetAsideWork {
  bytes: Uint8Array;
  /** Fingerprint of the file as it was on disk. Null for work put aside by a
   *  version of Mari that didn't record one, which can't be vouched for. */
  base: string | null;
}

/**
 * A short, stable fingerprint of a file's bytes (FNV-1a, 32-bit).
 *
 * Only ever compared against another fingerprint of the same kind, so it needs
 * to be quick and to change when the bytes change — not to be unguessable.
 * A `.mari` is a zip, so even a one-word edit moves most of it.
 */
export function fingerprint(bytes: Uint8Array): string {
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    // The FNV prime, as shifts: a plain multiply overflows past 32 bits.
    hash = (hash + ((hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24))) >>> 0;
  }
  return `${bytes.length.toString(36)}-${hash.toString(36)}`;
}

export interface Resolution {
  /** What to open. */
  bytes: Uint8Array;
  /** True when the unsaved changes were put back, so the chapter is dirty. */
  restored: boolean;
  /** True when unsaved changes were dropped because the file had moved on. */
  dropped: boolean;
}

/** Whether to open the file or the unsaved changes held against it. */
export function resolveSetAside(disk: Uint8Array, waiting: SetAsideWork | undefined): Resolution {
  if (!waiting) return { bytes: disk, restored: false, dropped: false };
  if (waiting.base !== null && waiting.base === fingerprint(disk)) {
    return { bytes: waiting.bytes, restored: true, dropped: false };
  }
  // Either the file changed under the unsaved work, or the work predates Mari
  // recording what it was based on. Neither can be trusted over the file.
  return { bytes: disk, restored: false, dropped: true };
}
