/** Synchronous — window.__TAURI_INTERNALS__ is present as soon as the script runs, no IPC round-trip needed. */
export function isTauriDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/** Terminal integration only makes sense on Linux desktop for now — Tauri only, never the browser build. */
export async function isLinuxDesktop(): Promise<boolean> {
  if (!isTauriDesktop()) return false;
  const { platform } = await import("@tauri-apps/plugin-os");
  return platform() === "linux";
}
