/** Synchronous: window.__TAURI_INTERNALS__ is present as soon as the script runs, no IPC round-trip needed. */
export function isTauriDesktop(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
