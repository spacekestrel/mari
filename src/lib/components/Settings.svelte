<script lang="ts">
  import Icon from "./Icon.svelte";
  import { FONT_OPTIONS } from "$lib/fonts";
  import { fontPreference } from "$lib/fontPreference.svelte";
  import { deletePreference } from "$lib/deletePreference.svelte";
  import { i18n, LOCALE_OPTIONS } from "$lib/i18n.svelte";

  /**
   * The settings themselves, with no button of their own: they live inside the
   * cat menu's popover, which owns opening, closing and dismissal.
   */
</script>

<div class="settings">
  <div class="section-header">{i18n.t.settings.language}</div>
  <!-- A list like the fonts below rather than a dropdown. There are two of
       them: a dropdown hides one behind a click and brings the system's own
       widget into a panel that is otherwise Mari's. -->
  <div class="options">
    {#each LOCALE_OPTIONS as locale (locale.id)}
      <button
        class="option"
        class:selected={i18n.current === locale.id}
        onclick={() => i18n.select(locale.id)}
      >
        <span class="check">
          {#if i18n.current === locale.id}
            <Icon name="check" size={14} />
          {/if}
        </span>
        {locale.label}
      </button>
    {/each}
  </div>

  <!-- None of these carry Chinese, so in Chinese they all render as the same
       system face and the list would be five identical choices. -->
  {#if i18n.current !== "zh"}
    <div class="section-header">{i18n.t.settings.font}</div>
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
  {/if}

  <div class="section-header">{i18n.t.settings.confirmations}</div>
  <label class="toggle-row">
    <input
      type="checkbox"
      checked={!deletePreference.skipConfirm}
      onchange={(e) => deletePreference.set(!e.currentTarget.checked)}
    />
    {i18n.t.settings.confirmBeforeDeleting}
  </label>
</div>

<style>
  .settings {
    display: block;
  }

  .section-header {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--color-text-muted);
    font-weight: 600;
    padding: var(--space-2) var(--space-2) var(--space-1);
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
