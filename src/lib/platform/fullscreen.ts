import { isTauriDesktop } from "./os";

export async function enterFullscreen(): Promise<void> {
  if (isTauriDesktop()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(true);
  } else if (document.documentElement.requestFullscreen) {
    await document.documentElement.requestFullscreen().catch(() => {});
  }
}

export async function exitFullscreen(): Promise<void> {
  if (isTauriDesktop()) {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(false);
  } else if (document.fullscreenElement) {
    await document.exitFullscreen().catch(() => {});
  }
}
