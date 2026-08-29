<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { MariCut } from "$lib/mariBundle";
  import { copyText } from "$lib/clipboard";

  /**
   * The chapter's drawer: everything cut out of it, kept against the file.
   * The clipboard forgets the moment you cut something else; this doesn't.
   * Deliberately separate from a chunk's version history, which is about
   * rewriting something that's still here.
   */
  interface Props {
    cuts: MariCut[];
    onPutBack: (cut: MariCut) => void;
    onDelete: (cut: MariCut) => void;
    onClose: () => void;
  }

  let { cuts, onPutBack, onDelete, onClose }: Props = $props();

  let expandedId = $state<string | null>(null);
  /** Delete asks once, inline, rather than throwing up a whole dialog. */
  let confirmingId = $state<string | null>(null);
  /** Which entry just got copied, so the button can say so briefly. */
  let copiedId = $state<string | null>(null);
  let copiedTimer: ReturnType<typeof setTimeout> | undefined;

  async function copy(cut: MariCut) {
    await copyText(cut.text);
    copiedId = cut.id;
    clearTimeout(copiedTimer);
    copiedTimer = setTimeout(() => (copiedId = null), 1500);
  }

  /** Newest first: what you just cut is what you're most likely after. */
  const ordered = $derived([...cuts].sort((a, b) => (b.cutAt ?? "").localeCompare(a.cutAt ?? "")));

  function preview(text: string): string {
    const line = text.trim().split("\n").find((l) => l.trim()) ?? "";
    return line.length > 80 ? `${line.slice(0, 80)}…` : line;
  }

  function wordCount(text: string): string {
    const n = text.trim() ? text.trim().split(/\s+/).length : 0;
    return `${n} ${n === 1 ? "word" : "words"}`;
  }

  function when(iso: string): string {
    if (!iso) return "";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
  }

  function toggle(cut: MariCut) {
    expandedId = expandedId === cut.id ? null : cut.id;
    confirmingId = null;
  }
</script>

<div class="panel">
  <header>
    <button class="icon-btn" onclick={onClose} title="Close" aria-label="Close">
      <Icon name="x" size={14} />
    </button>
  </header>

  {#if ordered.length === 0}
    <p class="empty">The drawer is empty.</p>
  {:else}
    <ul>
      {#each ordered as cut (cut.id)}
        <li class:expanded={expandedId === cut.id}>
          <button class="row" onclick={() => toggle(cut)}>
            <!-- Expanded, the passage itself is right below, so repeating its
                 first line here would just say the same thing twice. -->
            {#if expandedId !== cut.id}
              <span class="preview">{preview(cut.text)}</span>
            {/if}
            <span class="meta">{wordCount(cut.text)}{when(cut.cutAt) ? ` · ${when(cut.cutAt)}` : ""}</span>
          </button>

          {#if expandedId === cut.id}
            <div class="body">
              <div class="full">{cut.text}</div>

              <div class="actions">
                {#if confirmingId === cut.id}
                  <button class="btn btn-danger" onclick={() => onDelete(cut)}>Delete for good</button>
                  <button class="btn push-right" onclick={() => (confirmingId = null)}>Keep it</button>
                {:else}
                  <button class="btn btn-quiet" onclick={() => (confirmingId = cut.id)}>Delete</button>
                  <button
                    class="btn btn-icon push-right"
                    onclick={() => copy(cut)}
                    title="Copy the text"
                    aria-label="Copy the text"
                  >
                    <Icon name={copiedId === cut.id ? "check" : "copy"} size={13} />
                  </button>
                  <button class="btn" onclick={() => onPutBack(cut)}>Put back</button>
                {/if}
              </div>
            </div>
          {/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  /* Hangs under the "Drawer" word in the chapter header rather than being a
     full-height sidebar — it's a short list, and the height of the document
     has nothing to do with how much is in it. Left edge lines up with the
     header's own box (its 10px negative margin inside the 1rem inset). */
  .panel {
    position: absolute;
    top: calc(var(--chapter-header-height, 0px) + 6px);
    left: calc(var(--space-4) - 10px);
    width: 340px;
    max-width: calc(100% - var(--space-4) * 2);
    max-height: 60%;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
    z-index: 150;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  header {
    display: flex;
    justify-content: flex-end;
    padding: 4px 4px 0;
    flex-shrink: 0;
  }

  .icon-btn {
    display: inline-flex;
    padding: 4px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .icon-btn:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .empty {
    margin: 0;
    padding: 0 var(--space-4) var(--space-4);
    font-size: 0.82rem;
    line-height: 1.6;
    color: var(--color-text-muted);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
    overflow-y: auto;
    min-height: 0;
  }

  li:last-child {
    border-bottom: none;
  }

  li {
    border-bottom: 1px solid var(--color-border);
  }

  .row {
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: var(--space-3) var(--space-4);
    border: none;
    background: none;
    text-align: left;
    cursor: pointer;
    font-family: var(--font-ui);
  }

  /* Expanded, the row is just the byline above the passage — no need for it
     to keep the full height it has when it's the whole entry. */
  li.expanded .row {
    padding-bottom: var(--space-2);
  }

  /* One padded column, so the passage, the note and the buttons all share the
     row's left edge instead of each carrying their own margin. */
  .body {
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
    padding: 0 var(--space-4) var(--space-4);
  }

  .row:hover {
    background: var(--color-hover);
  }

  .preview {
    font-size: 0.82rem;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .meta {
    font-size: 0.72rem;
    color: var(--color-text-muted);
  }

  /* The passage itself reads in the prose voice — it is prose, after all. */
  .full {
    max-height: 30vh;
    overflow-y: auto;
    padding: var(--space-3);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-prose);
    font-weight: var(--font-prose-weight);
    font-size: 0.95rem;
    line-height: 1.7;
    white-space: pre-wrap;
  }


  .actions {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }

  .btn {
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    padding: 5px 12px;
    font-size: 0.8rem;
    cursor: pointer;
  }

  .btn:hover {
    background: var(--color-hover);
  }

  .btn-icon {
    display: inline-flex;
    align-items: center;
    padding: 5px 8px;
  }

  /* Delete sits alone on the left; everything after this is pushed right. */
  .push-right {
    margin-left: auto;
  }

  .btn-quiet {
    border-color: transparent;
    background: none;
    color: var(--color-text-muted);
  }

  .btn-danger {
    background: #e5484d;
    border-color: #e5484d;
    color: white;
  }

  .btn-danger:hover {
    background: #d63c41;
  }
</style>
