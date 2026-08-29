const KEY = "mari-last-dir";

/** Persists across restarts — the Tauri webview's localStorage lives on disk like a browser profile. */
export function getLastDirectory(): string | undefined {
  return localStorage.getItem(KEY) ?? undefined;
}

export function setLastDirectory(path: string): void {
  localStorage.setItem(KEY, path);
}
