import type { FileSystemAdapter } from "./types";

export type { FileSystemAdapter, OpenedFile, FsEntry } from "./types";
export { basename } from "./types";

function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

let cached: FileSystemAdapter | undefined;

/** Lazily picks the right adapter so the Tauri APIs are never imported in a plain browser tab. */
export async function getFileSystemAdapter(): Promise<FileSystemAdapter> {
  if (cached) return cached;

  if (isTauri()) {
    const { tauriAdapter } = await import("./tauriAdapter");
    cached = tauriAdapter;
  } else {
    const { browserAdapter } = await import("./browserAdapter");
    cached = browserAdapter;
  }

  return cached;
}
