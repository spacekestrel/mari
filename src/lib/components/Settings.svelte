<script lang="ts">
  import Icon from "./Icon.svelte";
  import { FONT_OPTIONS } from "$lib/fonts";
  import { fontPreference } from "$lib/fontPreference.svelte";
  import { deletePreference } from "$lib/deletePreference.svelte";

  let open = $state(false);
  let container: HTMLDivElement;

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

<div class="settings" bind:this={container}>
  <button class="icon-btn" class:active={open} onclick={() => (open = !open)} title="Settings" aria-label="Settings">
    <Icon name="settings" />
  </button>

  {#if open}
    <div class="popover">
      <div class="popover-arrow"></div>
      <div class="popover-header">Font</div>
      <div class="options">
        {#each FONT_OPTIONS as font (font.id)}
          <button
            class="option"
            class:selected={fontPreference.current.id === font.id}
            style="font-family: {font.family}; font-weight: {font.weight};"
            onclick={() => fontPreference.select(font.id)}
          >
            <span class="check">
              {#if fontPreference.current.id === font.id}
                <Icon name="check" size={14} />
              {/if}
            </span>
            {font.label}
          </button>
        {/each}
      </div>
      <div class="popover-header">Confirmations</div>
      <label class="toggle-row">
        <input
          type="checkbox"
          checked={!deletePreference.skipConfirm}
          onchange={(e) => deletePreference.set(!e.currentTarget.checked)}
        />
        Confirm before deleting
      </label>
    </div>
  {/if}
</div>

<style>
  .settings {
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

  .popover {
    position: absolute;
    top: calc(100% + 10px);
    right: 0;
    width: 200px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: var(--space-2);
    z-index: 50;
    animation: pop-in 0.12s ease;
  }

  .popover-arrow {
    position: absolute;
    top: -6px;
    right: 10px;
    width: 11px;
    height: 11px;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    border-top: 1px solid var(--color-border);
    transform: rotate(45deg);
  }

  .popover-header {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
    font-weight: 600;
    padding: var(--space-1) var(--space-2) var(--space-2);
  }

  .options {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .option {
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
    font-size: 0.95rem;
    cursor: pointer;
  }

  .option:hover {
    background: var(--color-hover);
  }

  .option.selected {
    color: var(--color-accent);
  }

  .check {
    display: inline-flex;
    width: 14px;
    flex-shrink: 0;
    color: var(--color-accent);
  }

  .toggle-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 8px;
    font-size: 0.82rem;
    color: var(--color-text);
    cursor: pointer;
  }
</style>
