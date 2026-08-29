<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { Terminal as XTerm } from "@xterm/xterm";
  import { FitAddon } from "@xterm/addon-fit";
  import { invoke } from "@tauri-apps/api/core";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import Icon from "./Icon.svelte";
  import { theme } from "$lib/theme.svelte";
  import "@xterm/xterm/css/xterm.css";

  interface Props {
    onClose: () => void;
    cwd?: string;
  }

  let { onClose, cwd }: Props = $props();

  let container: HTMLDivElement;
  let term: XTerm | undefined;
  let fitAddon: FitAddon | undefined;
  let unlistenOutput: UnlistenFn | undefined;
  let resizeObserver: ResizeObserver | undefined;

  function xtermTheme() {
    const style = getComputedStyle(document.documentElement);
    const read = (name: string) => style.getPropertyValue(name).trim();
    return {
      background: read("--color-bg"),
      foreground: read("--color-text"),
      cursor: read("--color-accent"),
      selectionBackground: read("--color-selection"),
    };
  }

  function fitAndResizePty() {
    if (!term || !fitAddon) return;
    fitAddon.fit();
    invoke("pty_resize", { cols: term.cols, rows: term.rows }).catch(() => {});
  }

  onMount(() => {
    term = new XTerm({
      fontFamily: "ui-monospace, Menlo, Consolas, monospace",
      fontSize: 13,
      cursorBlink: true,
      theme: xtermTheme(),
    });
    fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(container);
    fitAddon.fit();

    invoke("pty_spawn", { cols: term.cols, rows: term.rows, cwd }).catch(() => {
      term?.writeln("Failed to start terminal.");
    });

    term.onData((data) => {
      invoke("pty_write", { data }).catch(() => {});
    });

    listen<string>("pty://output", (event) => {
      term?.write(event.payload);
    }).then((fn) => (unlistenOutput = fn));

    resizeObserver = new ResizeObserver(() => fitAndResizePty());
    resizeObserver.observe(container);
  });

  onDestroy(() => {
    resizeObserver?.disconnect();
    unlistenOutput?.();
    term?.dispose();
    invoke("pty_kill").catch(() => {});
  });

  $effect(() => {
    theme.current;
    term?.options && (term.options.theme = xtermTheme());
  });
</script>

<div class="terminal-panel">
  <div class="terminal-header">
    <span class="terminal-title">Terminal</span>
    <div class="terminal-actions">
      <button class="text-btn" onclick={() => term?.clear()}>Clear</button>
      <button class="icon-btn" onclick={onClose} title="Close terminal" aria-label="Close terminal">
        <Icon name="x" size={14} />
      </button>
    </div>
  </div>
  <div class="terminal-body" bind:this={container}></div>
</div>

<style>
  .terminal-panel {
    display: flex;
    flex-direction: column;
    height: 260px;
    border-top: 1px solid var(--color-border);
    background: var(--color-bg);
    flex-shrink: 0;
  }

  .terminal-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    flex-shrink: 0;
  }

  .terminal-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    font-weight: 600;
  }

  .terminal-actions {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .terminal-actions .icon-btn {
    width: 26px;
    height: 26px;
  }

  .terminal-body {
    flex: 1;
    min-height: 0;
    padding: var(--space-2);
  }

  .text-btn {
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.78rem;
    padding: var(--space-1) var(--space-2);
    border-radius: var(--radius);
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .text-btn:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: var(--radius);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .icon-btn:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }
</style>
