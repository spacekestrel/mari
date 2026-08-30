import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, readFile, readTextFile, remove, rename, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { dirname, join } from "@tauri-apps/api/path";
import { basename, sortFsEntries, type FileSystemAdapter, type FsEntry } from "./types";
import { getLastDirectory, setLastDirectory } from "./lastDirectory";

// The plain-text pickers must not offer `.mari` — those are zips and would be
// mangled by being read as text. Bundles go through the binary pickers below.
const FILTERS = [{ name: "Text", extensions: ["md", "markdown", "txt"] }];

/** Every format the byte pickers handle, and what to call it in a dialog. */
const FORMAT_NAMES: Record<string, string> = {
  mari: "Mari chapter",
  docx: "Word document",
  md: "Markdown",
  markdown: "Markdown",
  txt: "Plain text",
};

/**
 * One entry per format so the dialog offers a real choice — saving picks the
 * format this way. A combined entry leads when there's more than one, so
 * opening still shows everything at once.
 */
function binaryFilters(extensions: string[]) {
  const named = extensions.map((e) => ({ name: FORMAT_NAMES[e] ?? e.toUpperCase(), extensions: [e] }));
  return extensions.length > 1 ? [{ name: "All supported", extensions }, ...named] : named;
}

export const tauriAdapter: FileSystemAdapter = {
  kind: "tauri",

  async open() {
    const path = await openDialog({ multiple: false, filters: FILTERS, defaultPath: getLastDirectory() });
    if (!path || Array.isArray(path)) return null;

    setLastDirectory(await dirname(path));
    const content = await readTextFile(path);
    return { name: basename(path), content, handle: path };
  },

  async save(file, content) {
    const path = file.handle as string;
    await writeTextFile(path, content);
  },

  async saveAs(content, suggestedName) {
    const lastDir = getLastDirectory();
    const defaultPath = lastDir ? await join(lastDir, suggestedName) : suggestedName;
    const path = await saveDialog({ defaultPath, filters: FILTERS });
    if (!path) return null;

    setLastDirectory(await dirname(path));
    await writeTextFile(path, content);
    return { name: basename(path), content, handle: path };
  },

  async openFolder() {
    const path = await openDialog({ directory: true, defaultPath: getLastDirectory() });
    if (!path || Array.isArray(path)) return null;

    setLastDirectory(path);
    return { name: basename(path), path, kind: "directory", handle: path };
  },

  async readDir(dir) {
    const base = dir.handle as string;
    const entries = await readDir(base);

    const mapped = await Promise.all(
      entries.map(async (entry): Promise<FsEntry> => {
        const path = await join(base, entry.name ?? "");
        return { name: entry.name ?? "", path, kind: entry.isDirectory ? "directory" : "file", handle: path };
      }),
    );

    return sortFsEntries(mapped);
  },

  async readFile(entry) {
    const path = entry.handle as string;
    const content = await readTextFile(path);
    return { name: entry.name, content, handle: path };
  },

  async createFile(dir, name) {
    const path = await join(dir.handle as string, name);
    await writeTextFile(path, "");
    return { name, path, kind: "file", handle: path };
  },

  async createFolder(dir, name) {
    const path = await join(dir.handle as string, name);
    await mkdir(path);
    return { name, path, kind: "directory", handle: path };
  },

  async deleteEntry(entry) {
    await remove(entry.handle as string, { recursive: true });
  },



  async readBinaryFile(entry) {
    return readFile(entry.handle as string);
  },

  async saveBinary(file, data) {
    await writeFile(file.handle as string, data);
  },

  async saveBinaryAs(data, suggestedName) {
    // The filter follows whatever is being written, so exporting a Word file
    // doesn't offer to save it as `.mari`.
    const extension = suggestedName.split(".").pop()?.toLowerCase() ?? "mari";
    const path = await saveDialog({ defaultPath: suggestedName, filters: binaryFilters([extension]) });
    if (!path) return null;
    setLastDirectory(await dirname(path));
    await writeFile(path, data);
    return { name: basename(path), content: "", handle: path };
  },

  async openBinary(extensions) {
    const path = await openDialog({
      multiple: false,
      filters: binaryFilters(extensions),
      defaultPath: getLastDirectory(),
    });
    if (!path || Array.isArray(path)) return null;
    setLastDirectory(await dirname(path));
    return { name: basename(path), data: await readFile(path), handle: path };
  },

  async moveEntry(entry, targetDir) {
    const from = entry.handle as string;
    const to = await join(targetDir.handle as string, entry.name);
    if (from === to) return entry;
    await rename(from, to);
    return { name: entry.name, path: to, kind: entry.kind, handle: to };
  },

  async chooseSaveTarget(extensions, suggestedName) {
    const lastDir = getLastDirectory();
    const defaultPath = lastDir ? await join(lastDir, suggestedName) : suggestedName;
    const path = await saveDialog({ defaultPath, filters: binaryFilters(extensions) });
    if (!path) return null;
    setLastDirectory(await dirname(path));
    return { name: basename(path), handle: path };
  },
};
