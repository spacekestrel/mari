<script lang="ts">
  import { onMount } from "svelte";
  import FileMenu from "./FileMenu.svelte";
  import Icon from "./Icon.svelte";
  import type { getCurrentWindow as GetCurrentWindow } from "@tauri-apps/api/window";

  interface Props {
    onNew: () => void;
    onOpenFile: () => void;
    onOpenFolder: () => void;
    onSave: () => void;
    onExportAs: () => void;
    onOpenMari: () => void;
    onSaveAsMari: () => void;
    onOpenDocx: () => void;
    onExportDocx: () => void;
    canUseTerminal: boolean;
    onToggleTerminal: () => void;
  }

  let { onNew, onOpenFile, onOpenFolder, onSave, onExportAs, onOpenMari, onSaveAsMari, onOpenDocx, onExportDocx, canUseTerminal, onToggleTerminal }: Props = $props();

  let appWindow: ReturnType<typeof GetCurrentWindow> | null = null;

  onMount(async () => {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    appWindow = getCurrentWindow();
  });
</script>

<div class="titlebar" data-tauri-drag-region>
  <div class="titlebar-side">
    <FileMenu {onNew} {onOpenFile} {onOpenFolder} {onSave} {onExportAs} {onOpenMari} {onSaveAsMari} {onOpenDocx} {onExportDocx} {canUseTerminal} {onToggleTerminal} />
  </div>
  <div class="titlebar-title" data-tauri-drag-region>Mari</div>
  <div class="titlebar-side titlebar-controls">
    <button class="win-btn" onclick={() => appWindow?.minimize()} aria-label="Minimize">
      <Icon name="win-minimize" size={14} />
    </button>
    <button class="win-btn" onclick={() => appWindow?.toggleMaximize()} aria-label="Maximize">
      <Icon name="win-maximize" size={12} />
    </button>
    <button class="win-btn win-close" onclick={() => appWindow?.close()} aria-label="Close">
      <Icon name="x" size={14} />
    </button>
  </div>
</div>

<style>
  .titlebar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    height: 36px;
    padding: 0 var(--space-2);
    background: var(--color-surface);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
    user-select: none;
  }

  .titlebar-side {
    display: flex;
    align-items: center;
  }

  .titlebar-controls {
    justify-self: end;
    gap: 2px;
  }

  .titlebar-title {
    text-align: center;
    font-size: 0.78rem;
    font-weight: 600;
    color: var(--color-text-muted);
    letter-spacing: 0.02em;
  }

  .win-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 28px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: var(--radius);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .win-btn:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .win-close:hover {
    background: #e5484d;
    color: white;
  }
</style>
