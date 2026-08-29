<script lang="ts">
  import Icon from "./Icon.svelte";
  import catIcon from "$lib/assets/mari-icon.png";
  import { theme } from "$lib/theme.svelte";

  interface Props {
    onNew: () => void;
    onOpenFile: () => void;
    onOpenFolder: () => void;
    onSave: () => void;
    onExportAs: () => void;
    onOpenMari: () => void;
    onSaveAsMari: () => void;
    canUseTerminal: boolean;
    onToggleTerminal: () => void;
  }

  let {
    onNew,
    onOpenFile,
    onOpenFolder,
    onSave,
    onExportAs,
    onOpenMari,
    onSaveAsMari,
    canUseTerminal,
    onToggleTerminal,
  }: Props = $props();

  let open = $state(false);
  let container: HTMLDivElement;

  function run(action: () => void) {
    open = false;
    action();
  }

  function handleWindowClick(e: MouseEvent) {
    if (open && !container?.contains(e.target as Node)) {
      open = false;
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && open) {
      e.stopPropagation();
      open = false;
    }
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<div class="file-menu" bind:this={container}>
  <button class="icon-btn" class:active={open} onclick={() => (open = !open)} title="Menu" aria-label="File menu">
    <img src={catIcon} alt="" class="cat-icon" />
  </button>

  {#if open}
    <div class="popover">
      <div class="popover-arrow"></div>
      <button class="row" onclick={() => run(onNew)}>
        <Icon name="file-plus" size={16} />
        New file
        <span class="shortcut">Ctrl+N</span>
      </button>
      <button class="row" onclick={() => run(onOpenFile)}>
        <Icon name="file" size={16} />
        Open file
        <span class="shortcut">Ctrl+O</span>
      </button>
      <button class="row" onclick={() => run(onOpenMari)}>
        <Icon name="file" size={16} />
        Open .mari&hellip;
      </button>
      <button class="row" onclick={() => run(onOpenFolder)}>
        <Icon name="folder" size={16} />
        Open folder
        <span class="shortcut">Ctrl+Shift+O</span>
      </button>
      <button class="row" onclick={() => run(onSave)}>
        <Icon name="save" size={16} />
        Save
        <span class="shortcut">Ctrl+S</span>
      </button>
      <button class="row" onclick={() => run(onSaveAsMari)}>
        <Icon name="save" size={16} />
        Save as .mari&hellip;
      </button>
      <button class="row" onclick={() => run(onExportAs)}>
        <Icon name="save" size={16} />
        Export as&hellip;
        <span class="shortcut">Ctrl+Shift+S</span>
      </button>
      {#if canUseTerminal}
        <div class="divider"></div>
        <button class="row" onclick={() => run(onToggleTerminal)}>
          <Icon name="terminal" size={16} />
          Toggle terminal
        </button>
      {/if}
      <div class="divider"></div>
      <!-- Theme lives here rather than in Settings: Settings holds
           format-specific options, and this applies to the whole app. -->
      <button class="row" onclick={() => run(() => theme.toggle())}>
        <Icon name={theme.current === "dark" ? "sun" : "moon"} size={16} />
        {theme.current === "dark" ? "Light mode" : "Dark mode"}
      </button>
    </div>
  {/if}
</div>

<style>
  .file-menu {
    position: relative;
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: var(--radius);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: background-color 0.12s ease, color 0.12s ease;
  }

  .icon-btn:hover,
  .icon-btn.active {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .cat-icon {
    width: 20px;
    height: 20px;
    object-fit: contain;
    border-radius: 4px;
    display: block;
  }

  .popover {
    position: absolute;
    top: calc(100% + 10px);
    left: 0;
    width: 210px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 6px;
    z-index: 50;
    animation: pop-in 0.12s ease;
  }

  .popover-arrow {
    position: absolute;
    top: -6px;
    left: 10px;
    width: 11px;
    height: 11px;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    border-top: 1px solid var(--color-border);
    transform: rotate(45deg);
  }

  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 100%;
    text-align: left;
    padding: 7px 8px;
    border: none;
    background: transparent;
    border-radius: 6px;
    color: var(--color-text);
    font-size: 0.85rem;
    cursor: pointer;
  }

  .row:hover {
    background: var(--color-hover);
  }

  .shortcut {
    margin-left: auto;
    font-size: 0.68rem;
    color: var(--color-text-muted);
  }

  .divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 4px;
  }

  @keyframes pop-in {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
