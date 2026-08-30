<script lang="ts">
  import Icon from "./Icon.svelte";

  let open = $state(false);
  let container: HTMLDivElement;

  const rows: [string, string][] = [
    ["# text", "Heading"],
    ["**text**", "Bold"],
    ["*text*", "Italic"],
    ["> text", "Quote"],
    ["- text", "Bullet list"],
    ["1. text", "Numbered list"],
    ["[text](url)", "Link"],
    ["---", "Scene break"],
  ];

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

<div class="hint" bind:this={container}>
  <button
    class="icon-btn"
    class:active={open}
    onclick={() => (open = !open)}
    title="Markdown cheat sheet"
    aria-label="Markdown cheat sheet"
  >
    <Icon name="help" />
  </button>

  {#if open}
    <div class="popover">
      <div class="popover-arrow"></div>
      <div class="popover-header">Markdown</div>
      <div class="rows">
        {#each rows as [syntax, label] (syntax)}
          <div class="row">
            <code>{syntax}</code>
            <span>{label}</span>
          </div>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style>
  .hint {
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
    width: 220px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 10px;
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.14), 0 2px 8px rgba(0, 0, 0, 0.08);
    padding: var(--space-3);
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
    margin-bottom: var(--space-2);
  }

  .rows {
    display: flex;
    flex-direction: column;
    gap: 7px;
  }

  .row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--space-3);
  }

  .row code {
    font-family: ui-monospace, monospace;
    font-size: 0.76rem;
    background: var(--color-hover);
    color: var(--color-action);
    padding: 2px 6px;
    border-radius: 4px;
    white-space: nowrap;
  }

  .row span {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    text-align: right;
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
