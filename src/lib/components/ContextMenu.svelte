<script lang="ts">
  import { onMount, untrack } from "svelte";
  import Icon, { type IconName } from "./Icon.svelte";

  export interface ContextMenuItem {
    label: string;
    icon?: IconName;
    colorSwatch?: string;
    danger?: boolean;
    /** Shown right-aligned — this is how the shortcuts get learned. */
    shortcut?: string;
    onClick: () => void;
  }

  interface Props {
    x: number;
    y: number;
    items: ContextMenuItem[];
    onDismiss: () => void;
  }

  let { x, y, items, onDismiss }: Props = $props();

  let menuEl: HTMLDivElement;
  // Snapshot on purpose — the menu's position shouldn't track the trigger point live.
  let left = $state(untrack(() => x));
  let top = $state(untrack(() => y));

  onMount(() => {
    const rect = menuEl.getBoundingClientRect();
    const overflowX = rect.right - window.innerWidth;
    const overflowY = rect.bottom - window.innerHeight;
    if (overflowX > 0) left = Math.max(0, left - overflowX);
    if (overflowY > 0) top = Math.max(0, top - overflowY);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onDismiss();
    }
  }
</script>

<svelte:window onclick={onDismiss} oncontextmenu={onDismiss} onkeydown={handleKeydown} />

<!-- svelte-ignore a11y_click_events_have_key_events -->
<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="menu"
  bind:this={menuEl}
  style="left: {left}px; top: {top}px;"
  onclick={(e) => e.stopPropagation()}
  role="menu"
  tabindex="-1"
>
  {#each items as item (item.label)}
    <button
      class="item"
      class:danger={item.danger}
      onclick={() => {
        item.onClick();
        onDismiss();
      }}
      role="menuitem"
    >
      {#if item.colorSwatch}<span class="swatch" style="background-color: {item.colorSwatch}"></span>{/if}
      {#if item.icon}<Icon name={item.icon} size={14} />{/if}
      <span class="item-label">{item.label}</span>
      {#if item.shortcut}<span class="item-shortcut">{item.shortcut}</span>{/if}
    </button>
  {/each}
</div>

<style>
  .menu {
    position: fixed;
    z-index: 200;
    min-width: 160px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: 4px;
  }

  .item {
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

  .item:hover {
    background: var(--color-hover);
  }

  .item.danger {
    color: #e5484d;
  }

  .item.danger:hover {
    background: rgba(229, 72, 77, 0.1);
  }

  .swatch {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .item-label {
    flex: 1;
  }

  .item-shortcut {
    flex-shrink: 0;
    padding-left: var(--space-3);
    font-size: 0.75rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }
</style>
