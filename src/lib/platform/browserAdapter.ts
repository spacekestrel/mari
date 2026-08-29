import { sortFsEntries, type FileSystemAdapter, type FsEntry } from "./types";

const TYPES = [
  { description: "Text", accept: { "text/markdown": [".md", ".markdown"], "text/plain": [".txt"] } },
];

/** `.mari` bundles are zips, so they go through the binary picker paths. */
const MARI_TYPES = [{ description: "Mari", accept: { "application/octet-stream": [".mari"] } }];

/** Shared across open/save/open-folder so the browser remembers one "last location" for all of them. */
const REMEMBERED_LOCATION_ID = "mari-last-location";

const hasFileSystemAccess = typeof window !== "undefined" && !!window.showOpenFilePicker;

/** Picker promises reject with AbortError when the user cancels; treat that as "null", not a crash. */
async function ignoringCancellation<T>(pick: () => Promise<T>): Promise<T | null> {
  try {
    return await pick();
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return null;
    throw err;
  }
}

/** Chromium/Edge: real file handles, closest experience to the desktop app. */
const fsAccessAdapter: FileSystemAdapter = {
  kind: "browser-fs-access",

  async open() {
    const picked = await ignoringCancellation(() =>
      window.showOpenFilePicker!({ multiple: false, types: TYPES, id: REMEMBERED_LOCATION_ID }),
    );
    if (!picked) return null;
    const [handle] = picked;
    const file = await handle.getFile();
    return { name: file.name, content: await file.text(), handle };
  },

  async save(file, content) {
    const handle = file.handle as FileSystemFileHandle;
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
  },

  async saveAs(content, suggestedName) {
    const handle = await ignoringCancellation(() =>
      window.showSaveFilePicker!({ suggestedName, types: TYPES, id: REMEMBERED_LOCATION_ID }),
    );
    if (!handle) return null;
    const writable = await handle.createWritable();
    await writable.write(content);
    await writable.close();
    return { name: handle.name, content, handle };
  },

  async openFolder() {
    const handle = await ignoringCancellation(() => window.showDirectoryPicker!({ id: REMEMBERED_LOCATION_ID }));
    if (!handle) return null;
    return { name: handle.name, path: handle.name, kind: "directory", handle };
  },

  async readDir(dir) {
    const dirHandle = dir.handle as FileSystemDirectoryHandle;
    const entries: FsEntry[] = [];

    for await (const [name, handle] of dirHandle.entries()) {
      entries.push({ name, path: `${dir.path}/${name}`, kind: handle.kind, handle });
    }

    return sortFsEntries(entries);
  },

  async readFile(entry) {
    const handle = entry.handle as FileSystemFileHandle;
    const file = await handle.getFile();
    return { name: entry.name, content: await file.text(), handle };
  },

  async createFile(dir, name) {
    const dirHandle = dir.handle as FileSystemDirectoryHandle;
    const handle = await dirHandle.getFileHandle(name, { create: true });
    return { name, path: `${dir.path}/${name}`, kind: "file", handle };
  },

  async createFolder(dir, name) {
    const dirHandle = dir.handle as FileSystemDirectoryHandle;
    const handle = await dirHandle.getDirectoryHandle(name, { create: true });
    return { name, path: `${dir.path}/${name}`, kind: "directory", handle };
  },

  async deleteEntry(entry, parent) {
    const parentHandle = parent.handle as FileSystemDirectoryHandle;
    await parentHandle.removeEntry(entry.name, { recursive: true });
  },



  async readBinaryFile(entry) {
    const handle = entry.handle as FileSystemFileHandle;
    const file = await handle.getFile();
    return new Uint8Array(await file.arrayBuffer());
  },

  async saveBinary(file, data) {
    const handle = file.handle as FileSystemFileHandle;
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  },

  async saveBinaryAs(data, suggestedName) {
    const handle = await ignoringCancellation(() =>
      window.showSaveFilePicker!({ suggestedName, types: MARI_TYPES, id: REMEMBERED_LOCATION_ID }),
    );
    if (!handle) return null;
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
    return { name: handle.name, content: "", handle };
  },

  async openBinary(extensions) {
    const accept: Record<string, string[]> = { "application/octet-stream": extensions.map((e) => `.${e}`) };
    const picked = await ignoringCancellation(() =>
      window.showOpenFilePicker!({
        multiple: false,
        types: [{ description: "Documents", accept }],
        id: REMEMBERED_LOCATION_ID,
      }),
    );
    if (!picked) return null;
    const [handle] = picked;
    const file = await handle.getFile();
    return { name: file.name, data: new Uint8Array(await file.arrayBuffer()), handle };
  },

  async chooseSaveTarget(extensions, suggestedName) {
    const accept: Record<string, string[]> = {
      "application/octet-stream": extensions.map((e) => `.${e}`),
    };
    const handle = await ignoringCancellation(() =>
      window.showSaveFilePicker!({
        suggestedName,
        types: [{ description: "Documents", accept }],
        id: REMEMBERED_LOCATION_ID,
      }),
    );
    if (!handle) return null;
    return { name: handle.name, handle };
  },
};

/** Firefox/Safari fallback: upload input for open, download-blob for save. */
const downloadFallbackAdapter: FileSystemAdapter = {
  kind: "browser-fallback",

  open() {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".md,.markdown,.txt,text/markdown,text/plain";
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        resolve({ name: file.name, content: await file.text(), handle: file.name });
      };
      input.click();
    });
  },

  async save(file, content) {
    // No handle to write back to in this fallback; treat every save as "save as".
    await downloadFallbackAdapter.saveAs(content, file.name);
  },

  async saveAs(content, suggestedName) {
    const blob = new Blob([content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return { name: suggestedName, content, handle: suggestedName };
  },

  async openFolder() {
    alert("Folder browsing isn't supported in this browser. Try Chrome or Edge, or open individual files instead.");
    return null;
  },

  async readDir() {
    return [];
  },

  async readFile(entry) {
    throw new Error(`Cannot read "${entry.name}": folder browsing is unsupported in this browser.`);
  },

  async createFile(dir) {
    throw new Error(`Cannot create files in "${dir.name}": folder browsing is unsupported in this browser.`);
  },

  async createFolder(dir) {
    throw new Error(`Cannot create folders in "${dir.name}": folder browsing is unsupported in this browser.`);
  },

  async deleteEntry(entry) {
    throw new Error(`Cannot delete "${entry.name}": folder browsing is unsupported in this browser.`);
  },



  readBinaryFile() {
    return new Promise<Uint8Array>((resolve, reject) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".mari";
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return reject(new Error("No file chosen"));
        resolve(new Uint8Array(await f.arrayBuffer()));
      };
      input.click();
    });
  },

  // No handle to write back to in this fallback; every save is a download.
  async saveBinary(file, data) {
    await downloadFallbackAdapter.saveBinaryAs(data, file.name);
  },

  async saveBinaryAs(data, suggestedName) {
    const blob = new Blob([data as BlobPart], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = suggestedName;
    a.click();
    URL.revokeObjectURL(url);
    return { name: suggestedName, content: "", handle: suggestedName };
  },

  openBinary(extensions) {
    return new Promise((resolve) => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = extensions.map((e) => `.${e}`).join(",");
      input.onchange = async () => {
        const f = input.files?.[0];
        if (!f) return resolve(null);
        resolve({ name: f.name, data: new Uint8Array(await f.arrayBuffer()), handle: f.name });
      };
      input.click();
    });
  },

  // This fallback has no save picker at all — every write is a download, so
  // the suggested name is the destination and the format follows from it.
  async chooseSaveTarget(_extensions, suggestedName) {
    return { name: suggestedName, handle: suggestedName };
  },
};

export const browserAdapter: FileSystemAdapter = hasFileSystemAccess
  ? fsAccessAdapter
  : downloadFallbackAdapter;
