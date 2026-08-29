<script lang="ts">
  import type { Inline, Block } from "$lib/markdownFormat";

  /**
   * The little bar that appears over a selection. Formatting only: highlights
   * stay on Alt+1..8 and the right-click menu, because they mean something
   * different and mixing them here would bury the ones people use most.
   */
  interface Props {
    /** Screen position of the selection's top edge, in viewport pixels. */
    x: number;
    y: number;
    /** Which buttons should read as already applied. */
    active: { inline: Inline[]; block: Block | null };
    onInline: (kind: Inline) => void;
    onBlock: (kind: Block) => void;
  }

  let { x, y, active, onInline, onBlock }: Props = $props();

  let bar = $state<HTMLDivElement>();

  // Measured after mount so the bar can be centred on the selection and kept
  // on screen. Zero until then, which is why it starts hidden.
  let width = $state(0);
  let height = $state(0);

  $effect(() => {
    if (!bar) return;
    const box = bar.getBoundingClientRect();
    width = box.width;
    height = box.height;
  });

  const GAP = 8;

  const left = $derived(
    width === 0 ? 0 : Math.min(Math.max(8, x - width / 2), window.innerWidth - width - 8),
  );

  // Above the selection normally; underneath it when there isn't room, so the
  // bar never sits off the top of the window.
  const flipped = $derived(height > 0 && y - height - GAP < 8);
  const top = $derived(flipped ? y + GAP * 3 : y - height - GAP);
</script>

<div
  bind:this={bar}
  class="bar"
  style="left: {left}px; top: {top}px; visibility: {width ? 'visible' : 'hidden'}"
  role="toolbar"
  aria-label="Formatting"
  tabindex="-1"
  onmousedown={(e) => e.preventDefault()}
>
  <button
    class="btn"
    class:on={active.inline.includes("bold")}
    title="Bold"
    aria-label="Bold"
    aria-pressed={active.inline.includes("bold")}
    onclick={() => onInline("bold")}><span class="bold">B</span></button
  >
  <button
    class="btn"
    class:on={active.inline.includes("italic")}
    title="Italic"
    aria-label="Italic"
    aria-pressed={active.inline.includes("italic")}
    onclick={() => onInline("italic")}><span class="italic">I</span></button
  >
  <button
    class="btn"
    class:on={active.inline.includes("strike")}
    title="Strikethrough"
    aria-label="Strikethrough"
    aria-pressed={active.inline.includes("strike")}
    onclick={() => onInline("strike")}><span class="strike">S</span></button
  >

  <span class="divider"></span>

  <button
    class="btn"
    class:on={active.block === "heading1"}
    title="Heading"
    aria-label="Heading"
    aria-pressed={active.block === "heading1"}
    onclick={() => onBlock("heading1")}><span class="t-big">T</span></button
  >
  <button
    class="btn"
    class:on={active.block === "heading2"}
    title="Subheading"
    aria-label="Subheading"
    aria-pressed={active.block === "heading2"}
    onclick={() => onBlock("heading2")}><span class="t-small">T</span></button
  >
  <button
    class="btn"
    class:on={active.block === "quote"}
    title="Quote"
    aria-label="Quote"
    aria-pressed={active.block === "quote"}
    onclick={() => onBlock("quote")}
  >
    <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.5 6C5.6 6 4 7.6 4 9.5S5.6 13 7.5 13c.3 0 .6 0 .9-.1-.4 1.8-1.8 3.2-3.6 3.6l.5 1.9c3.2-.7 5.5-3.6 5.5-7V9.5C10.8 7.6 9.3 6 7.5 6Zm9 0C14.6 6 13 7.6 13 9.5s1.6 3.5 3.5 3.5c.3 0 .6 0 .9-.1-.4 1.8-1.8 3.2-3.6 3.6l.5 1.9c3.2-.7 5.5-3.6 5.5-7V9.5C19.8 7.6 18.3 6 16.5 6Z"
      />
    </svg>
  </button>
</div>

<style>
  /* Fixed, because the coordinates come straight from getBoundingClientRect
     on the selection — the same approach the highlight menu uses. */
  .bar {
    position: fixed;
    z-index: 60;
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 4px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 8px;
    box-shadow:
      0 10px 28px rgba(0, 0, 0, 0.14),
      0 2px 8px rgba(0, 0, 0, 0.08);
  }

  .btn {
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    border: none;
    border-radius: 6px;
    background: transparent;
    color: var(--color-text);
    cursor: pointer;
    font-family: var(--font-ui);
    line-height: 1;
  }

  .btn:hover {
    background: var(--color-hover);
  }

  .btn.on {
    background: var(--color-hover);
    color: var(--color-accent);
  }

  .divider {
    width: 1px;
    height: 18px;
    margin: 0 4px;
    background: var(--color-border);
  }

  .bold {
    font-weight: 700;
    font-size: 0.85rem;
  }

  .italic {
    font-family: var(--font-prose);
    font-style: italic;
    font-size: 0.95rem;
  }

  .strike {
    font-size: 0.85rem;
    text-decoration: line-through;
  }

  .t-big {
    font-weight: 600;
    font-size: 1.05rem;
  }

  .t-small {
    font-weight: 600;
    font-size: 0.72rem;
  }
</style>
