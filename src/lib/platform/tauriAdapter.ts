import { open as openDialog, save as saveDialog } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, readFile, readTextFile, remove, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { dirname, join } from "@tauri-apps/api/path";
import { basename, sortFsEntries, type FileSystemAdapter, type FsEntry } from "./types";
import { getLastDirectory, setLastDirectory } from "./lastDirectory";

// The plain-text pickers must not offer `.mari` — those are zips and would be
// mangled by being read as text. Bundles go through the binary pickers below.
const FILTERS = [{ name: "Text", extensions: ["md", "markdown", "txt"] }];
const MARI_FILTERS = [{ name: "Mari", extensions: ["mari"] }];

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
    const path = await saveDialog({ defaultPath: suggestedName, filters: MARI_FILTERS });
    if (!path) return null;
    setLastDirectory(await dirname(path));
    await writeFile(path, data);
    return { name: basename(path), content: "", handle: path };
  },

  async openBinary(extensions) {
    const path = await openDialog({
      multiple: false,
      filters: [{ name: "Mari", extensions }],
      defaultPath: getLastDirectory(),
    });
    if (!path || Array.isArray(path)) return null;
    setLastDirectory(await dirname(path));
    return { name: basename(path), data: await readFile(path), handle: path };
  },
};
