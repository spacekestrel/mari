<script lang="ts">
  import { untrack } from "svelte";
  import { diffWordsWithSpace } from "diff";
  import Icon from "./Icon.svelte";
  import type { ChunkVersion } from "$lib/chunkHistory";
  import { draftPanelWidth } from "$lib/draftPanelWidth.svelte";
  import { HIGHLIGHT_STATES } from "$lib/highlightStates";

  interface Props {
    originalText: string; // the chunk's current live text
    history: ChunkVersion[];
    // "write" opens straight into drafting (Tweak/Rewrite/Expand/Unsure);
    // "history" opens straight into the version list with no drafting offered
    // (Good/Cut — the mark means "decided," but past history still browsable).
    startMode: "write" | "history";
    /**
     * `keepState` says what the passage should be left marked as: null clears
     * it, a state id re-marks it, and "keep" leaves whatever is already there.
     */
    onReplace: (newText: string, keepState: string | null | "keep") => void;
    onClose: () => void;
  }

  let { originalText, history, startMode, onReplace, onClose }: Props = $props();

  type Mode = "write" | "compare" | "history";
  // Deliberate one-time snapshots — this component is fully remounted for
  // each chunk (the caller always passes through draftPanel=null in between),
  // so props changing later shouldn't retroactively reset in-progress state.
  let mode = $state<Mode>(untrack(() => startMode));
  let draftText = $state(untrack(() => originalText));
  let viewingVersion = $state<ChunkVersion | null>(null);

  // Drag-to-resize, same as the sidebar: listeners on window rather than the
  // handle, so the drag survives the pointer outrunning a 7px strip.
  let resizing = $state(false);

  function startResize(event: MouseEvent) {
    event.preventDefault();
    resizing = true;
    const startX = event.clientX;
    const startWidth = draftPanelWidth.current;

    // Dragging left widens it: the panel is pinned to the right-hand edge.
    const onMove = (e: MouseEvent) => draftPanelWidth.set(startWidth - (e.clientX - startX));
    const onUp = () => {
      resizing = false;
      draftPanelWidth.persist();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function handleSaveDraft() {
    mode = "compare";
  }

  function handleKeepTweaking() {
    mode = "write";
  }

  /**
   * Replacing means the writer is satisfied, so the mark that asked for the
   * rewrite has done its job and goes. Unless they say otherwise here — a
   * rewrite that still needs another look shouldn't lose its place.
   */
  let keepState = $state<string | null>(null);

  function handleReplace() {
    onReplace(draftText, keepState);
  }

  function handleRestoreVersion(version: ChunkVersion) {
    // Restoring an older wording isn't finishing a rewrite — whatever mark the
    // passage carries is about where it stands, so it stays as it is.
    onReplace(version.text, "keep");
  }

  function formatTimestamp(iso: string): string {
    try {
      return new Date(iso).toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
    } catch {
      // Deliberately silent: an unparseable timestamp is shown raw rather than
      // hiding a version the writer might want.
      return iso;
    }
  }

  interface DiffRun {
    text: string;
    changed: boolean;
  }

  function buildDiff(oldText: string, newText: string): { left: DiffRun[]; right: DiffRun[] } {
    const parts = diffWordsWithSpace(oldText, newText);
    const left: DiffRun[] = [];
    const right: DiffRun[] = [];
    for (const part of parts) {
      if (part.removed) left.push({ text: part.value, changed: true });
      else if (part.added) right.push({ text: part.value, changed: true });
      else {
        left.push({ text: part.value, changed: false });
        right.push({ text: part.value, changed: false });
      }
    }
    return { left, right };
  }

  const compareDiff = $derived(mode === "compare" ? buildDiff(originalText, draftText) : null);
  const historyDiff = $derived(viewingVersion ? buildDiff(viewingVersion.text, originalText) : null);

  const historyDesc = $derived([...history].reverse());
</script>

<div class="panel" style="width: {draftPanelWidth.current}px">
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="resize-handle"
    class:active={resizing}
    onmousedown={startResize}
    ondblclick={() => draftPanelWidth.reset()}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize panel"
    title="Drag to resize — double-click to reset"
  ></div>
  <div class="panel-header">
    <span class="title">
      {#if mode === "write"}
        Draft a rewrite
      {:else if mode === "compare"}
        Compare
      {:else}
        Version history
      {/if}
    </span>
    <button class="icon-btn" onclick={onClose} aria-label="Close" title="Close">
      <Icon name="x" size={16} />
    </button>
  </div>

  <div class="panel-body">
    {#if mode === "write"}
      <textarea class="draft-area" bind:value={draftText} placeholder="Write your rewrite here..."></textarea>
      <div class="actions">
        <button class="btn primary" onclick={handleSaveDraft}>Compare</button>
      </div>
      {#if history.length > 0}
        <button class="history-link" onclick={() => (mode = "history")}>
          <Icon name="history" size={14} />
          {history.length} earlier version{history.length === 1 ? "" : "s"}
        </button>
      {/if}
    {:else if mode === "compare" && compareDiff}
      <div class="compare-columns">
        <div class="column">
          <div class="column-label">Original</div>
          <div class="column-text">
            {#each compareDiff.left as run, i (i)}
              <span class:removed={run.changed}>{run.text}</span>
            {/each}
          </div>
        </div>
        <div class="column">
          <div class="column-label">Draft</div>
          <div class="column-text">
            {#each compareDiff.right as run, i (i)}
              <span class:added={run.changed}>{run.text}</span>
            {/each}
          </div>
        </div>
      </div>
      <div class="after-replace">
        <span class="after-label">Afterwards</span>
        <div class="state-choices">
          <button class="state-choice" class:chosen={keepState === null} onclick={() => (keepState = null)}>
            No mark
          </button>
          {#each HIGHLIGHT_STATES.filter((state) => state.id !== "cut") as state (state.id)}
            <button
              class="state-choice"
              class:chosen={keepState === state.id}
              onclick={() => (keepState = state.id)}
              title={`Leave this passage marked ${state.label}`}
            >
              <span class="state-dot" style="background: {state.solid}"></span>
              {state.label}
            </button>
          {/each}
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick={handleKeepTweaking}>Keep tweaking</button>
        <button class="btn primary" onclick={handleReplace}>Replace</button>
      </div>
    {:else if mode === "history"}
      {#if viewingVersion && historyDiff}
        <button class="back-link" onclick={() => (viewingVersion = null)}>&larr; Back to list</button>
        <div class="compare-columns">
          <div class="column">
            <div class="column-label">
              {viewingVersion.kind === "moved" ? "Before move" : "Selected version"} · {formatTimestamp(
                viewingVersion.createdAt,
              )}
            </div>
            <div class="column-text">
              {#each historyDiff.left as run, i (i)}
                <span class:removed={run.changed}>{run.text}</span>
              {/each}
            </div>
          </div>
          <div class="column">
            <div class="column-label">Current</div>
            <div class="column-text">
              {#each historyDiff.right as run, i (i)}
                <span class:added={run.changed}>{run.text}</span>
              {/each}
            </div>
          </div>
        </div>
        {#if viewingVersion.kind === "draft"}
          <div class="actions">
            <button class="btn primary" onclick={() => viewingVersion && handleRestoreVersion(viewingVersion)}>
              Restore this version
            </button>
          </div>
        {/if}
      {:else}
        {#if startMode === "write"}
          <button class="back-link" onclick={() => (mode = "write")}>&larr; Back to draft</button>
        {/if}
        <ul class="history-list">
          {#each historyDesc as version (version.id)}
            <li>
              <button class="history-item" onclick={() => (viewingVersion = version)}>
                <span class="history-item-meta">
                  <span class="badge" class:moved={version.kind === "moved"}>
                    {version.kind === "moved" ? "Moved" : "Draft"}
                  </span>
                  <span class="history-item-date">{formatTimestamp(version.createdAt)}</span>
                </span>
                <span class="history-item-preview">{version.text.slice(0, 80)}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    {/if}
  </div>
</div>

<style>
  .panel {
    /* Width comes from the inline style so it can be dragged; the bounds here
       mirror the clamp in the store as a second line of defence. */
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    min-width: 320px;
    max-width: 95vw;
    background: var(--color-surface);
    border-left: 1px solid var(--color-border);
    box-shadow: -8px 0 24px rgba(0, 0, 0, 0.08);
    z-index: 150;
    display: flex;
    flex-direction: column;
  }

  /* Quiet by default: clearing the mark is the expected outcome, so this is
     here to be noticed only by someone who wants something else. */
  /* No padding of its own: the panel body already provides it, and adding
     more indented this row past the boxes above it. */
  .after-replace {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .after-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
  }

  /* A grid rather than a wrapped row, so the chips line up down the columns
     as well as across the rows however wide the panel is. */
  .state-choices {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(118px, 1fr));
    gap: 4px;
  }

  .state-choice {
    display: flex;
    align-items: center;
    justify-content: flex-start;
    gap: 5px;
    padding: 3px 8px;
    border: 1px solid transparent;
    border-radius: 999px;
    background: none;
    color: var(--color-text-muted);
    font-family: var(--font-ui);
    font-size: 0.75rem;
    cursor: pointer;
  }

  .state-choice:hover {
    background: var(--color-hover);
  }

  .state-choice.chosen {
    border-color: var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
  }

  .state-dot {
    flex-shrink: 0;
    width: 7px;
    height: 7px;
    border-radius: 50%;
  }

  .resize-handle {
    position: absolute;
    top: 0;
    left: -3px;
    width: 7px;
    height: 100%;
    cursor: col-resize;
    z-index: 5;
  }

  .resize-handle:hover::after,
  .resize-handle.active::after {
    content: "";
    position: absolute;
    top: 0;
    left: 3px;
    width: 1px;
    height: 100%;
    background: var(--color-accent);
  }

  .panel-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-3) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    flex-shrink: 0;
  }

  .title {
    font-size: 0.9rem;
    font-weight: 600;
    color: var(--color-text);
  }

  .icon-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    border-radius: 6px;
    cursor: pointer;
  }

  .icon-btn:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .panel-body {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: var(--space-4);
    display: flex;
    flex-direction: column;
    gap: var(--space-3);
  }

  .draft-area {
    flex: 1;
    min-height: 200px;
    resize: none;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-prose);
    font-size: 0.95rem;
    line-height: 1.6;
    padding: var(--space-3);
  }

  .draft-area:focus {
    outline: none;
    border-color: var(--color-accent);
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
    flex-shrink: 0;
  }

  .btn {
    padding: 7px 14px;
    border-radius: 6px;
    border: 1px solid var(--color-border);
    background: transparent;
    color: var(--color-text);
    font-size: 0.85rem;
    cursor: pointer;
  }

  .btn:hover {
    background: var(--color-hover);
  }

  .btn.primary {
    background: var(--color-action);
    border-color: var(--color-action);
    color: #fff;
  }

  .btn.primary:hover {
    background: var(--color-action-hover);
    border-color: var(--color-action-hover);
  }

  .history-link,
  .back-link {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    align-self: flex-start;
    border: none;
    background: transparent;
    color: var(--color-text-muted);
    font-size: 0.8rem;
    cursor: pointer;
    padding: 4px 0;
  }

  .history-link:hover,
  .back-link:hover {
    color: var(--color-accent);
  }

  .compare-columns {
    display: flex;
    gap: var(--space-3);
    flex: 1;
    min-height: 0;
  }

  .column {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .column-label {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  .column-text {
    flex: 1;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    padding: var(--space-3);
    font-family: var(--font-prose);
    font-size: 0.9rem;
    line-height: 1.6;
    white-space: pre-wrap;
    /* A long unbroken run — a pasted URL, or typing with no spaces — was
       running off the side instead of wrapping. */
    overflow-wrap: anywhere;
  }

  .column-text .removed {
    background: rgba(235, 87, 87, 0.22);
    text-decoration: line-through;
    text-decoration-color: rgba(235, 87, 87, 0.6);
  }

  .column-text .added {
    background: rgba(92, 184, 92, 0.22);
  }

  .history-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .history-item {
    width: 100%;
    text-align: left;
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: var(--space-2) var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-bg);
    cursor: pointer;
  }

  .history-item:hover {
    border-color: var(--color-accent);
  }

  .history-item-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .badge {
    font-size: 0.68rem;
    text-transform: uppercase;
    letter-spacing: 0.03em;
    padding: 1px 6px;
    border-radius: 4px;
    background: var(--color-hover);
    color: var(--color-text-muted);
  }

  .badge.moved {
    color: #26c6da;
  }

  .history-item-date {
    font-size: 0.75rem;
    color: var(--color-text-muted);
  }

  .history-item-preview {
    font-size: 0.85rem;
    color: var(--color-text);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
