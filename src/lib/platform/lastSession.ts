const KEY = "mari-last-session";

export interface LastSession {
  folderPath?: string;
  filePath?: string;
}

/** Restoring across restarts only makes sense for real filesystem paths (Tauri) — see restoreSession in +page.svelte. */
export function getLastSession(): LastSession | undefined {
  const raw = localStorage.getItem(KEY);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as LastSession;
  } catch {
    // Deliberately silent: a corrupt entry only means the app opens without
    // reopening last time's file, which is exactly what a first run does.
    return undefined;
  }
}

export function setLastSession(session: LastSession): void {
  localStorage.setItem(KEY, JSON.stringify(session));
}

export function updateLastSession(patch: Partial<LastSession>): void {
  setLastSession({ ...getLastSession(), ...patch });
}
