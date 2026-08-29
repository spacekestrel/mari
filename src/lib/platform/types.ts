export interface OpenedFile {
  /** Display name shown in the UI, e.g. "chapter-one.md" */
  name: string;
  /** Full text content of the file. */
  content: string;
  /** Opaque handle the adapter needs to save back to the same file. */
  handle: unknown;
}

/** A file or directory inside an opened project folder. */
export interface FsEntry {
  name: string;
  /** Display path; not necessarily a real filesystem path in the browser adapter. */
  path: string;
  kind: "file" | "directory";
  /** Opaque handle the adapter needs to read/list this entry. */
  handle: unknown;
}

/**
 * Abstracts "open/save a text file" over whatever the host environment
 * actually offers: native dialogs + real files under Tauri, the browser
 * File System Access API (or a download/upload fallback) on the web.
 */
export interface FileSystemAdapter {
  readonly kind: "tauri" | "browser-fs-access" | "browser-fallback";

  /** Prompt the user to pick a .md/.txt file and read it. Null if cancelled. */
  open(): Promise<OpenedFile | null>;

  /** Save content back to the file it was opened/last saved from. */
  save(file: OpenedFile, content: string): Promise<void>;

  /** Prompt for a new location/name and save. Returns the updated handle info. */
  saveAs(content: string, suggestedName: string): Promise<OpenedFile | null>;

  /** Prompt the user to pick a project folder. Null if cancelled or unsupported. */
  openFolder(): Promise<FsEntry | null>;

  /** List the immediate children of a directory entry, folders first, alphabetically. */
  readDir(dir: FsEntry): Promise<FsEntry[]>;

  /** Read a file entry from the tree into an OpenedFile ready for editing/saving. */
  readFile(entry: FsEntry): Promise<OpenedFile>;

  /** Create an empty file named `name` inside `dir`. */
  createFile(dir: FsEntry, name: string): Promise<FsEntry>;

  /** Create a subdirectory named `name` inside `dir`. */
  createFolder(dir: FsEntry, name: string): Promise<FsEntry>;

  /** Delete a file or directory (recursively). `parent` is needed by adapters whose handles can't self-locate. */
  deleteEntry(entry: FsEntry, parent: FsEntry): Promise<void>;

  /**
   * Read a file's raw bytes. `.mari` bundles are zips, so they can't go
   * through the text paths above without being corrupted by decoding.
   */
  readBinaryFile(entry: FsEntry): Promise<Uint8Array>;

  /** Write raw bytes back to the file this handle refers to. */
  saveBinary(file: OpenedFile, data: Uint8Array): Promise<void>;

  /** Prompt for a location and write raw bytes. Null if cancelled. */
  saveBinaryAs(data: Uint8Array, suggestedName: string): Promise<OpenedFile | null>;

  /** Prompt the user to pick any file and read its raw bytes. Null if cancelled. */
  openBinary(extensions: string[]): Promise<{ name: string; data: Uint8Array; handle: unknown } | null>;
}

export function sortFsEntries(entries: FsEntry[]): FsEntry[] {
  return [...entries].sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === "directory" ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

export function basename(path: string): string {
  return path.split(/[\\/]/).pop() ?? path;
}
