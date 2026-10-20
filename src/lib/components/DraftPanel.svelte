<script lang="ts">
  import { tick, untrack } from "svelte";
  import { diffWordsWithSpace } from "diff";
  import Icon from "./Icon.svelte";
  import type { ChunkVersion } from "$lib/chunkHistory";
  import { draftPanelWidth } from "$lib/draftPanelWidth.svelte";
  import { countWords } from "$lib/wordcount";
  import { HIGHLIGHT_STATES, migrateStateId } from "$lib/highlightStates";
  import { i18n, highlightLabel } from "$lib/i18n.svelte";
  import {
    createDraftHistory,
    recordDraftEdit,
    redoDraft,
    undoDraft,
    type DraftHistory,
  } from "$lib/draftHistory";
  import FormatBar from "./FormatBar.svelte";
  import {
    isBlockActive,
    isInlineActive,
    toggleBlock,
    toggleInline,
    type Block,
    type Edit,
    type Inline,
  } from "$lib/markdownFormat";

  interface Props {
    originalText: string; // the chunk's current live text
    history: ChunkVersion[];
    // "write" opens straight into drafting (Tweak/Rewrite/Expand/Unsure);
    // "history" opens straight into the version list with no drafting offered
    // (Good/Cut: the mark means "decided," but past history still browsable).
    startMode: "write" | "history";
    /**
     * `keepState` says what the passage should be left marked as: null clears
     * it, a state id re-marks it, and "keep" leaves whatever is already there.
     */
    onReplace: (newText: string, keepState: string | null | "keep") => void;
    onClose: () => void;
    /**
     * What the passage is marked as. The panel wears its colour down its edge,
     * so there is no doubt which passage is open while the prose behind it is
     * scrolled away. Empty for a passage opened by its bracket, which has no
     * mark left to show.
     */
    stateId?: string;
  }

  let { originalText, history, startMode, onReplace, onClose, stateId = "" }: Props = $props();

  /** The colour of the mark the open passage carries, if it still carries one. */
  const edgeColor = $derived(
    HIGHLIGHT_STATES.find((state) => state.id === migrateStateId(stateId))?.solid,
  );

  type Mode = "write" | "compare" | "history";
  // Deliberate one-time snapshots. This component is fully remounted for
  // each chunk (the caller always passes through draftPanel=null in between),
  // so props changing later shouldn't retroactively reset in-progress state.
  let mode = $state<Mode>(untrack(() => startMode));
  let viewingVersion = $state<ChunkVersion | null>(null);

  /**
   * The draft and its undo trail, held as one thing: the trail is the draft's
   * own, and keeping them together is what lets Ctrl+Z still work after a trip
   * through Compare, which takes the box off screen and builds a new one.
   *
   * The caret starts at the end of the text, which is where a writer reading
   * the passage back would carry on from.
   */
  let edits = $state<DraftHistory>(
    untrack(() => createDraftHistory({ text: originalText, from: originalText.length, to: originalText.length })),
  );
  const draftText = $derived(edits.present.text);

  /** The box itself, so undo can put the caret back where the words changed. */
  let draftBox = $state<HTMLTextAreaElement | null>(null);

  /**
   * Puts the caret in the box whenever the draft comes on screen: opening the
   * panel, and coming back from Compare with Keep tweaking. Both are the
   * writer asking to write, so the box should be ready for them.
   *
   * It is also what keeps Ctrl+Z within reach. The panel only hears a key
   * while the focus is somewhere inside it, and Keep tweaking removes the very
   * button that was clicked, which left the focus on the page body, and the
   * draft with no undo, in exactly the place it was most wanted.
   *
   * Reads `edits` untracked: the caret is restored to where it last stood, and
   * this must not run again on every keystroke and fight for it.
   */
  $effect(() => {
    if (mode !== "write") return;
    const box = draftBox;
    if (!box || box === document.activeElement) return;
    const { from, to } = untrack(() => edits.present);
    box.focus();
    box.setSelectionRange(from, to);
  });

  function handleDraftInput(event: Event) {
    const box = event.currentTarget as HTMLTextAreaElement;
    edits = recordDraftEdit(
      edits,
      { text: box.value, from: box.selectionStart, to: box.selectionEnd },
      Date.now(),
    );
    // The words under the selection changed, so what the buttons should read
    // as applied may have changed with them.
    refreshFormatState();
  }

  /**
   * Bold, italic and the rest, over a selection in the draft.
   *
   * The same bar the chapter itself uses, and the same rules behind it: a
   * rewrite is Markdown exactly as the prose is, so formatting it is the same
   * job. Kept to the bar rather than given keys of its own, because that is
   * how formatting works everywhere else in Mari.
   *
   * It follows the selected words the way the chapter's own does, which takes
   * some doing over a textarea (see selectionPoint below).
   */
  let formatBar = $state<{ x: number; y: number } | null>(null);
  let formatActive = $state<{ inline: Inline[]; block: Block | null }>({ inline: [], block: null });

  function refreshFormatState() {
    const box = draftBox;
    if (!box) return;
    const text = box.value;
    const from = box.selectionStart;
    const to = box.selectionEnd;
    formatActive = {
      inline: (["bold", "italic", "strike"] as Inline[]).filter((kind) =>
        isInlineActive(text, from, to, kind),
      ),
      block:
        (["heading1", "heading2", "quote"] as Block[]).find((kind) =>
          isBlockActive(text, from, kind),
        ) ?? null,
    };
  }

  /**
   * Everything that decides where a character lands, so the hidden copy below
   * breaks its lines in exactly the same places as the real box.
   */
  const MIRRORED_STYLES = [
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "font-variant",
    "letter-spacing",
    "word-spacing",
    "line-height",
    "text-indent",
    "text-transform",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "border-top-width",
    "border-right-width",
    "border-bottom-width",
    "border-left-width",
  ];

  /**
   * Where the selected words sit on screen.
   *
   * A textarea draws its own text and will not say where any of it ended up:
   * there is no range to measure, the way there is over the chapter. So the
   * draft is laid out a second time in a hidden copy of the box, styled down
   * to the font and the wrapping, and the position is read off that.
   *
   * Without this the bar had nowhere to go but a fixed spot at the top of the
   * panel, which sat on the title and the close button and told the writer
   * nothing about which words it was going to act on.
   */
  function selectionPoint(box: HTMLTextAreaElement): { x: number; y: number } | null {
    const style = getComputedStyle(box);
    const mirror = document.createElement("div");
    for (const property of MIRRORED_STYLES) {
      mirror.style.setProperty(property, style.getPropertyValue(property));
    }
    mirror.style.position = "absolute";
    mirror.style.top = "0";
    mirror.style.left = "0";
    mirror.style.visibility = "hidden";
    mirror.style.pointerEvents = "none";
    mirror.style.whiteSpace = "pre-wrap";
    mirror.style.overflowWrap = "break-word";
    mirror.style.boxSizing = "border-box";
    // clientWidth leaves out the border and any scrollbar, which is exactly
    // the width the real text is being wrapped into.
    mirror.style.width = `${box.clientWidth}px`;

    mirror.textContent = box.value.slice(0, box.selectionStart);
    const marker = document.createElement("span");
    // A selection running to the very end has nothing after it to give the
    // span a height, so it is stood up by a single character instead.
    marker.textContent = box.value.slice(box.selectionStart, box.selectionEnd) || ".";
    mirror.appendChild(marker);

    document.body.appendChild(mirror);
    const markerBox = marker.getBoundingClientRect();
    const mirrorBox = mirror.getBoundingClientRect();
    document.body.removeChild(mirror);
    if (markerBox.height === 0) return null;

    const rect = box.getBoundingClientRect();
    return {
      // The first line of a selection spanning several, which is where the
      // writer's eye is and what the chapter's own bar follows.
      x: rect.left + (markerBox.left - mirrorBox.left) + Math.min(markerBox.width, box.clientWidth) / 2,
      y: rect.top + (markerBox.top - mirrorBox.top) - box.scrollTop,
    };
  }

  function showFormatBar() {
    const box = draftBox;
    if (!box || box.selectionStart === box.selectionEnd) {
      formatBar = null;
      return;
    }
    refreshFormatState();

    const point = selectionPoint(box);
    const rect = box.getBoundingClientRect();
    if (!point) {
      formatBar = null;
      return;
    }
    // Selections scrolled out of the box keep the bar at the nearest edge
    // rather than letting it wander off over the rest of the app.
    formatBar = {
      x: point.x,
      y: Math.min(Math.max(point.y, rect.top), rect.bottom),
    };
  }

  /** Deferred: the box hasn't finished moving its selection while the event runs. */
  function showFormatBarSoon() {
    setTimeout(showFormatBar, 0);
  }

  /**
   * Writes a formatting change into the draft through the undo trail, so one
   * Ctrl+Z takes the formatting off again rather than it being the one change
   * in the box that cannot be undone.
   */
  function applyFormatEdit(edit: Edit) {
    const box = draftBox;
    if (!box) return;
    const next = box.value.slice(0, edit.from) + edit.insert + box.value.slice(edit.to);
    edits = recordDraftEdit(edits, { text: next, from: edit.selectFrom, to: edit.selectTo }, Date.now());

    tick().then(() => {
      draftBox?.focus();
      draftBox?.setSelectionRange(edit.selectFrom, edit.selectTo);
      // The same words stay selected, so the bar stays up and can be pressed
      // again, turning italic back off without reselecting.
      showFormatBar();
    });
  }

  function applyInline(kind: Inline) {
    const box = draftBox;
    if (!box) return;
    const edit = toggleInline(box.value, box.selectionStart, box.selectionEnd, kind);
    if (edit) applyFormatEdit(edit);
  }

  function applyBlock(kind: Block) {
    const box = draftBox;
    if (!box) return;
    applyFormatEdit(toggleBlock(box.value, box.selectionStart, kind, box.selectionEnd));
  }

  /**
   * Which editing key was pressed, named so it works on any keyboard.
   *
   * A Latin letter is taken from the character the key produces: on a German
   * keyboard the Z key sits where Y is on a US one, and going by position
   * would turn its undo into a redo. A layout that produces no Latin letter at
   * all (Cyrillic reports Ctrl+Z as "я") is taken from the key's position
   * instead, which is the only thing left to go on.
   */
  function editingKey(event: KeyboardEvent): string | null {
    if (/^[a-z]$/i.test(event.key)) return event.key.toUpperCase();
    return /^Key([A-Z])$/.exec(event.code)?.[1] ?? null;
  }

  /** Moves the draft to another step and puts the caret back with it. */
  async function goToStep(next: DraftHistory | null) {
    if (!next) return;
    edits = next;
    // The box's contents are written by Svelte, so the caret can only be set
    // once that has happened.
    await tick();
    draftBox?.focus();
    draftBox?.setSelectionRange(next.present.from, next.present.to);
  }

  /**
   * Ctrl+Z and Ctrl+Shift+Z (or Ctrl+Y) over the draft.
   *
   * On the panel rather than the box so it still answers when the focus is on
   * one of the panel's own buttons, and only while the draft is on screen:
   * stepping through text nobody can see would be worse than doing nothing.
   *
   * The key is always taken, never passed on: the textarea's own undo is
   * half-working here, and letting both run would leave the box showing one
   * thing and the trail holding another.
   */
  function handlePanelKeydown(event: KeyboardEvent) {
    if (mode !== "write") return;
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return;

    const key = editingKey(event);
    if (key === "Z") {
      event.preventDefault();
      goToStep(event.shiftKey ? redoDraft(edits) : undoDraft(edits));
    } else if (key === "Y" && !event.shiftKey) {
      event.preventDefault();
      goToStep(redoDraft(edits));
    }
  }

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
   * rewrite has done its job and goes. Unless they say otherwise here: a
   * rewrite that still needs another look shouldn't lose its place.
   */
  let keepState = $state<string | null>(null);

  function handleReplace() {
    onReplace(draftText, keepState);
  }

  function handleRestoreVersion(version: ChunkVersion) {
    // Restoring an older wording isn't finishing a rewrite. Whatever mark the
    // passage carries is about where it stands, so it stays as it is.
    onReplace(version.text, "keep");
  }

  function formatTimestamp(iso: string): string {
    try {
      return new Date(iso).toLocaleString(i18n.tag, {
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

  /**
   * How much longer or shorter the rewrite came out.
   *
   * Length is the thing a writer is usually trying to change when they open
   * this panel, whether tightening a flabby paragraph or filling out a thin
   * one, and reading two columns of prose side by side will not tell you
   * whether you managed it.
   */
  const originalWords = $derived(countWords(originalText));
  const draftWords = $derived(countWords(draftText));
  const wordDelta = $derived(draftWords - originalWords);

  const draftLengthNote = $derived(
    wordDelta === 0
      ? i18n.t.draft.sameLength
      : wordDelta > 0
        ? i18n.t.draft.longerBy(wordDelta)
        : i18n.t.draft.shorterBy(-wordDelta),
  );
  const historyDiff = $derived(viewingVersion ? buildDiff(viewingVersion.text, originalText) : null);

  const historyDesc = $derived([...history].reverse());

  /**
   * The mark a wording was carrying when it was retired, for the strip down
   * the side of its row.
   *
   * Run through the rename map first: a version recorded before "Keep" became
   * "Good" still names the old one, and would otherwise show no colour at all
   * rather than the green it was given.
   */
  function versionState(version: ChunkVersion) {
    if (!version.stateId) return undefined;
    const id = migrateStateId(version.stateId);
    return HIGHLIGHT_STATES.find((state) => state.id === id);
  }
</script>

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="panel"
  style="width: {draftPanelWidth.current}px; {edgeColor ? `--panel-edge: ${edgeColor}` : ''}"
  onkeydown={handlePanelKeydown}
>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="resize-handle"
    class:active={resizing}
    onmousedown={startResize}
    ondblclick={() => draftPanelWidth.reset()}
    role="separator"
    aria-orientation="vertical"
    aria-label={i18n.t.draft.resize}
    title={i18n.t.draft.dragToResize}
  ></div>
  <div class="panel-header">
    <span class="title">
      {#if mode === "write"}
        {i18n.t.draft.write}
      {:else if mode === "compare"}
        {i18n.t.draft.compare}
      {:else}
        {i18n.t.draft.history}
      {/if}
    </span>
    <button class="icon-btn" onclick={onClose} aria-label={i18n.t.draft.close} title={i18n.t.draft.close}>
      <Icon name="x" size={16} />
    </button>
  </div>

  <div class="panel-body">
    {#if mode === "write"}
      <!-- Not `bind:value`: every change has to go through the undo trail, so
           the box reads from it rather than writing straight past it. -->
      <textarea
        class="draft-area"
        bind:this={draftBox}
        value={draftText}
        oninput={handleDraftInput}
        onmouseup={showFormatBarSoon}
        onkeyup={showFormatBarSoon}
        placeholder={i18n.t.draft.placeholder}
      ></textarea>
      <div class="actions">
        <button class="btn primary" onclick={handleSaveDraft}>{i18n.t.draft.compare}</button>
      </div>
      {#if history.length > 0}
        <button class="history-link" onclick={() => (mode = "history")}>
          <Icon name="history" size={14} />
          {i18n.t.draft.earlierVersions(history.length)}
        </button>
      {/if}
    {:else if mode === "compare" && compareDiff}
      <div class="compare-columns">
        <div class="column">
          <div class="column-label">
            <span>{i18n.t.draft.original}</span>
            <span class="column-count">{i18n.t.draft.wordCount(originalWords)}</span>
          </div>
          <div class="column-text">
            {#each compareDiff.left as run, i (i)}
              <span class:removed={run.changed}>{run.text}</span>
            {/each}
          </div>
        </div>
        <div class="column">
          <div class="column-label">
            <span>{i18n.t.draft.draft}</span>
            <span class="column-count">
              {i18n.t.draft.wordCount(draftWords)}
              <span class="length-change" class:grew={wordDelta > 0} class:shrank={wordDelta < 0}>
                {draftLengthNote}
              </span>
            </span>
          </div>
          <div class="column-text">
            {#each compareDiff.right as run, i (i)}
              <span class:added={run.changed}>{run.text}</span>
            {/each}
          </div>
        </div>
      </div>
      <div class="after-replace">
        <span class="after-label">{i18n.t.draft.afterwards}</span>
        <div class="state-choices">
          <button class="state-choice" class:chosen={keepState === null} onclick={() => (keepState = null)}>
            {i18n.t.draft.noMark}
          </button>
          {#each HIGHLIGHT_STATES.filter((state) => state.id !== "cut") as state (state.id)}
            <button
              class="state-choice"
              class:chosen={keepState === state.id}
              onclick={() => (keepState = state.id)}
              title={i18n.t.draft.leaveMarked(highlightLabel(state.id, state.label))}
            >
              <span class="state-dot" style="background: {state.solid}"></span>
              {highlightLabel(state.id, state.label)}
            </button>
          {/each}
        </div>
      </div>
      <div class="actions">
        <button class="btn" onclick={handleKeepTweaking}>{i18n.t.draft.keepTweaking}</button>
        <button class="btn primary" onclick={handleReplace}>{i18n.t.draft.replace}</button>
      </div>
    {:else if mode === "history"}
      {#if viewingVersion && historyDiff}
        <button class="back-link" onclick={() => (viewingVersion = null)}>&larr; {i18n.t.draft.backToList}</button>
        <div class="compare-columns">
          <div class="column">
            <div class="column-label">
              {viewingVersion.kind === "moved" ? i18n.t.draft.beforeMove : i18n.t.draft.selectedVersion} · {formatTimestamp(
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
            <div class="column-label">{i18n.t.draft.current}</div>
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
              {i18n.t.draft.restoreVersion}
            </button>
          </div>
        {/if}
      {:else}
        {#if startMode === "write"}
          <button class="back-link" onclick={() => (mode = "write")}>&larr; {i18n.t.draft.backToDraft}</button>
        {/if}
        <ul class="history-list">
          {#each historyDesc as version (version.id)}
            {@const state = versionState(version)}
            <li>
              <button
                class="history-item"
                style={state ? `border-left-color: ${state.solid}` : ""}
                title={state ? highlightLabel(state.id, state.label) : undefined}
                onclick={() => (viewingVersion = version)}
              >
                <span class="history-item-meta">
                  <span class="badge" class:moved={version.kind === "moved"}>
                    {version.kind === "moved" ? i18n.t.draft.movedBadge : i18n.t.draft.draftBadge}
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

{#if mode === "write" && formatBar}
  <FormatBar
    x={formatBar.x}
    y={formatBar.y}
    active={formatActive}
    onInline={applyInline}
    onBlock={applyBlock}
    boundary={draftBox?.getBoundingClientRect().top ?? 8}
  />
{/if}

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
    /* Plain, like any other edge. The open passage's colour belongs on the
       writing box, where the eye already is; out here beside the prose it was
       only another coloured line to read past. It does appear on this edge
       while the panel is being dragged wider (see the handle below). */
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

  /* The line under the pointer while the edge is being dragged, in the open
     passage's colour, the one place the edge says which passage this is. */
  .resize-handle:hover::after,
  .resize-handle.active::after {
    content: "";
    position: absolute;
    top: 0;
    left: 3px;
    width: 1px;
    height: 100%;
    background: var(--panel-edge, var(--color-accent));
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

  /* The open passage's colour, the same one down the panel's edge, so the
     box you are writing in says which mark you are answering. Falls back to
     the accent for a passage with no mark left on it. */
  .draft-area:focus {
    outline: none;
    border-color: var(--panel-edge, var(--color-accent));
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
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    /* Wraps rather than squashing: the panel can be dragged narrow enough that
       the name and the count will not share a line. */
    flex-wrap: wrap;
    gap: 2px 8px;
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: var(--color-text-muted);
  }

  /* Not uppercased: these are numbers and a short phrase, and small-caps
     digits beside a heading read as part of the heading. */
  .column-count {
    text-transform: none;
    letter-spacing: 0;
    white-space: nowrap;
  }

  /* Said plainly, without colouring it a verdict: shorter is the point of a
     tightening pass and longer is the point of an expanding one, and the
     panel has no way of knowing which this was. */
  .length-change::before {
    content: "·";
    margin: 0 3px;
  }

  .length-change.grew,
  .length-change.shrank {
    color: var(--color-text);
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
    /* A long unbroken run (a pasted URL, or typing with no spaces) was
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
    /* The strip saying what the passage was marked as when this wording was
       retired. Always this wide, coloured or not, so the rows line up whether
       or not a version carries a mark. */
    border-left-width: 3px;
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
