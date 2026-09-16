<script lang="ts">
  import Icon from "./Icon.svelte";
  import Settings from "./Settings.svelte";
  import catIcon from "$lib/assets/mari-icon.png";
  import { theme } from "$lib/theme.svelte";
  import { i18n } from "$lib/i18n.svelte";

  interface Props {
    onNew: () => void;
    onOpenFile: () => void;
    onOpenFolder: () => void;
    onSave: () => void;
    onExportAs: () => void;
    canUseTerminal: boolean;
    onToggleTerminal: () => void;
  }

  let {
    onNew,
    onOpenFile,
    onOpenFolder,
    onSave,
    onExportAs,
    canUseTerminal,
    onToggleTerminal,
  }: Props = $props();

  let open = $state(false);
  /** The popover shows one thing at a time: the menu, or the settings behind it. */
  let view = $state<"menu" | "settings">("menu");

  let container: HTMLDivElement;

  function close() {
    open = false;
    // Next time it opens it should be the menu again, not wherever it was left.
    view = "menu";
  }

  function run(action: () => void) {
    close();
    action();
  }

  // The popover's own clicks never get here (see the stopPropagation below),
  // so this only has to spare the button that opened the menu — which is
  // still in the document, unlike the rows inside.
  function handleWindowClick(e: MouseEvent) {
    if (open && !container?.contains(e.target as Node)) {
      close();
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key !== "Escape" || !open) return;
    e.stopPropagation();
    // Escape backs out of settings first, so it never closes the whole menu
    // from under someone who only meant to leave the settings.
    if (view === "settings") view = "menu";
    else close();
  }
</script>

<svelte:window onclick={handleWindowClick} onkeydown={handleKeydown} />

<div class="file-menu" bind:this={container}>
  <button
    class="icon-btn"
    class:active={open}
    onclick={() => (open ? close() : (open = true))}
    title={i18n.t.menu.open}
    aria-label={i18n.t.menu.label}
  >
    <img src={catIcon} alt="" class="cat-icon" />
  </button>

  {#if open}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <!-- Kept from reaching the window's dismiss handler. Testing whether the
         click landed inside the menu isn't enough: opening Settings replaces
         the row that was clicked, and by the time the window sees the event
         that row is no longer in the document — so it reads as an outside
         click and shuts the menu the moment it's asked to open. -->
    <div class="popover" onclick={(e) => e.stopPropagation()}>
      <div class="popover-arrow"></div>
      {#if view === "menu"}
        <button class="row" onclick={() => run(onNew)}>
          <Icon name="file-plus" size={16} />
          {i18n.t.menu.newFile}
          <span class="shortcut">Ctrl+N</span>
        </button>
        <button class="row" onclick={() => run(onOpenFile)}>
          <Icon name="file" size={16} />
          {i18n.t.menu.openFile}
          <span class="shortcut">Ctrl+O</span>
        </button>
        <button class="row" onclick={() => run(onOpenFolder)}>
          <Icon name="folder" size={16} />
          {i18n.t.menu.openFolder}
          <span class="shortcut">Ctrl+Shift+O</span>
        </button>
        <button class="row" onclick={() => run(onSave)}>
          <Icon name="save" size={16} />
          {i18n.t.menu.save}
          <span class="shortcut">Ctrl+S</span>
        </button>
        <button class="row" onclick={() => run(onExportAs)}>
          <Icon name="save" size={16} />
          {i18n.t.menu.exportAs}
          <span class="shortcut">Ctrl+Shift+S</span>
        </button>
        {#if canUseTerminal}
          <div class="divider"></div>
          <button class="row" onclick={() => run(onToggleTerminal)}>
            <Icon name="terminal" size={16} />
            {i18n.t.menu.terminal}
          </button>
        {/if}
        <div class="divider"></div>
        <!-- Theme sits beside Settings rather than inside it: it's one click,
             and burying a switch behind a submenu makes it slower than it was. -->
        <button class="row" onclick={() => run(() => theme.toggle())}>
          <Icon name={theme.current === "dark" ? "sun" : "moon"} size={16} />
          {theme.current === "dark" ? i18n.t.menu.lightMode : i18n.t.menu.darkMode}
        </button>
        <!-- Everything else the app remembers about how it looks and behaves,
             one level down so the menu itself stays short. -->
        <button class="row" onclick={() => (view = "settings")}>
          <Icon name="settings" size={16} />
          {i18n.t.menu.settings}
          <span class="into"><Icon name="chevron-right" size={14} /></span>
        </button>
      {:else}
        <button class="row" onclick={() => (view = "menu")}>
          <span class="back-arrow"><Icon name="chevron-right" size={14} /></span>
          {i18n.t.menu.back}
        </button>
        <div class="divider"></div>
        <Settings />
      {/if}
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
    /* Wide enough for the longest Russian menu line, which runs about half as
       long again as its English original. */
    width: 250px;
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

  .into {
    display: inline-flex;
    margin-left: auto;
    color: var(--color-text-muted);
  }

  .back-arrow {
    display: inline-flex;
    color: var(--color-text-muted);
    transform: rotate(180deg);
  }

  .divider {
    height: 1px;
    background: var(--color-border);
    margin: 4px 4px;
  }

  /* Deliberately no opacity here. A menu that fades in from nothing is
     invisible until the animation runs, and if it never advances — the
     window not compositing, animations switched off, a throttled webview —
     it stays invisible and the menu looks broken. The slide is decoration;
     being visible isn't. */
  @keyframes pop-in {
    from {
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
</style>
