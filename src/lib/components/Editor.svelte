<script lang="ts">
  import { onMount, onDestroy, untrack } from "svelte";
  import { EditorView, keymap, placeholder as placeholderExt, Decoration, type DecorationSet } from "@codemirror/view";
  import { EditorState, StateField, StateEffect, Compartment, Transaction, type Range } from "@codemirror/state";
  import { defaultKeymap, history, historyKeymap, redo, selectAll, undo } from "@codemirror/commands";
  import { markdown } from "@codemirror/lang-markdown";
  import { syntaxHighlighting, HighlightStyle } from "@codemirror/language";
  import { hideMarkers } from "$lib/hideMarkers";
  import { richCopy } from "$lib/richCopy";
  import { tags } from "@lezer/highlight";
  import { Strikethrough } from "@lezer/markdown";
  import ContextMenu, { type ContextMenuItem } from "./ContextMenu.svelte";
  import FormatBar from "./FormatBar.svelte";
  import DraftPanel from "./DraftPanel.svelte";
  import DrawerPanel from "./DrawerPanel.svelte";
  import Icon from "./Icon.svelte";
  import ChapterHeader from "./ChapterHeader.svelte";
  import { emptySynopsis, type MariCut, type MariPlanBeat, type MariSynopsis } from "$lib/mariBundle";
  import { describeCut, findPutBackPosition } from "$lib/cuts";
  import {
    toggleInline,
    toggleBlock,
    isInlineActive,
    isBlockActive,
    type Inline,
    type Block,
  } from "$lib/markdownFormat";
  import { copyText } from "$lib/clipboard";
  import {
    clearHighlightById,
    clearHighlights,
    createHighlightField,
    makeHighlightMark,
    readHighlights,
    setHighlight,
  } from "$lib/highlightField";
  import { viewportIndicator, withAlpha, wrapLineIntoRows } from "$lib/minimapLayout";
  import { HIGHLIGHT_STATES } from "$lib/highlightStates";
  import type { ChunkVersion } from "$lib/chunkHistory";
  import { CHUNK_NOTE_MAX_LENGTH } from "$lib/chunkNotes";

  export interface HighlightRange {
    from: number;
    to: number;
    stateId: string;
    // Stable across state changes and document edits (survives the diff-based
    // remap) — lets chunk draft/version history stay attached to "this passage"
    // rather than "whatever's at this position," even as the mark or the
    // surrounding text changes.
    id: string;
  }

  interface Props {
    value: string;
    onChange: (text: string) => void;
    onHighlightsChange?: (highlights: HighlightRange[]) => void;
    // Seeds the highlight decorations at construction time — the only way to
    // get highlights into a *freshly built* view, as opposed to pendingHighlights
    // below (which only applies to an already-mounted instance swapping files).
    // Without this, any time this component gets torn down and rebuilt while a
    // file is open — which normally only happens on a real file switch, but also
    // happens on every dev-mode HMR reload of this file — the new view starts
    // with zero highlights even though the file's saved ones were never touched,
    // and the next Save/close would then persist that empty state over them.
    initialHighlights?: HighlightRange[];
    // Same rationale as initialHighlights — read once at construction so a
    // rebuilt instance (file switch or HMR) starts correctly seeded.
    initialChunkHistory?: Record<string, ChunkVersion[]>;
    // Fired whenever a new version is created (a Replace, or a Reposition
    // move) so the caller can persist it. Editor keeps its own local copy for
    // instant UI feedback; this is purely for the caller to write to disk.
    onChunkHistoryChange?: (chunkId: string, version: ChunkVersion) => void;
    // Same seeding rationale as initialHighlights: read once at construction
    // so a rebuilt instance (file switch or HMR) starts with the right notes.
    initialChunkNotes?: Record<string, string>;
    // Fired when a note is written or cleared (null = cleared).
    onChunkNoteChange?: (chunkId: string, note: string | null) => void;
    // Focus mode wants nothing but the prose: no minimap, no highlight
    // colours, no chunk action icons. The minimap is removed outright rather
    // than hidden, which also stops it redrawing while you write.
    focusMode?: boolean;
    /**
     * True for `.md` / `.txt` documents. Marks, notes, drafts and the minimap
     * belong to `.mari` files, so a plain document doesn't offer them at all —
     * showing the tools on a file that can't save their output just invites
     * work that gets thrown away on close.
     */
    plain?: boolean;
    /** What this chapter is: its plan, and its synopsis. */
    chapter?: MariSynopsis;
    onChapterChange?: (next: MariSynopsis) => void;
    /** Passages taken out of the prose but kept in the file. */
    cuts?: MariCut[];
    onCutsChange?: (next: MariCut[]) => void;
    // Where the writer was in this chapter, read once when this instance is
    // built. Needed for the first chapter after launch: there's no editor yet
    // for the caller to hand a position to, the same reason initialHighlights
    // exists alongside setPendingHighlights.
    initialPosition?: ViewPosition | null;
    /** Fired as the writer moves through the chapter, so the place can be kept. */
    onPlaceChange?: () => void;
  }

  // Subtle, prose-first styling: markup characters recede, emphasis reads naturally.
  const proseHighlightStyle = HighlightStyle.define([
    { tag: tags.heading, fontWeight: "600" },
    // Once the `#` characters are hidden, nothing but size separates a
    // chapter title from a scene heading.
    { tag: tags.heading1, fontWeight: "700", fontSize: "1.5em", lineHeight: "1.3" },
    { tag: tags.heading2, fontWeight: "700", fontSize: "1.25em", lineHeight: "1.35" },
    { tag: tags.heading3, fontWeight: "600", fontSize: "1.1em" },
    { tag: tags.strong, fontWeight: "700" },
    { tag: tags.emphasis, fontStyle: "italic" },
    { tag: tags.strikethrough, textDecoration: "line-through" },
    { tag: tags.link, color: "var(--color-accent)", textDecoration: "underline" },
    { tag: tags.url, color: "var(--color-accent)" },
    { tag: tags.monospace, fontFamily: "ui-monospace, monospace", color: "var(--color-text-muted)" },
    // Full-strength text: the rule down the left already says it's a quote,
    // and greying it makes quoted prose harder to read than the rest.
    { tag: tags.quote, fontStyle: "italic" },
    { tag: tags.processingInstruction, color: "var(--color-text-muted)" },
    { tag: tags.contentSeparator, color: "var(--color-text-muted)" },
  ]);

  let {
    value,
    onChange,
    onHighlightsChange,
    initialHighlights = [],
    initialChunkHistory = {},
    onChunkHistoryChange,
    initialChunkNotes = {},
    onChunkNoteChange,
    focusMode = false,
    plain = false,
    chapter = emptySynopsis(),
    onChapterChange,
    cuts = [],
    onCutsChange,
    initialPosition = null,
    onPlaceChange,
  }: Props = $props();

  // The header stays pinned in the document's top-left corner while the prose
  // scrolls underneath it. It's overlaid rather than in flow because
  // CodeMirror owns the scroller's children — the prose is pushed clear of it
  // by an equal amount of top padding instead.
  /** The prose's own breathing room at the edges, in px (CodeMirror's `0 1rem`). */
  const PROSE_GUTTER_MIN = 16;

  let headerEl = $state<HTMLDivElement | undefined>();
  let chapterHeaderRef = $state<ChapterHeader | undefined>();

  /** Commits a synopsis or plan still being typed. Called before saving. */
  export function flushChapterHeader() {
    chapterHeaderRef?.flush();
  }
  const showHeader = $derived(!plain && !focusMode);

  /**
   * The header's height with nothing unfolded. Unfolding the synopsis or plan
   * makes the header temporarily much taller, and if the prose reserved *that*
   * it would get shoved down the page every time one opened. It reserves this
   * instead, so an open panel simply lies over the writing.
   */
  let restingHeaderHeight = 0;

  function syncHeaderLayout() {
    if (!container) return;
    let height = 0;
    if (showHeader && headerEl) {
      if (!headerEl.querySelector("[data-panel-open]")) restingHeaderHeight = headerEl.offsetHeight;
      height = restingHeaderHeight;
    }
    container.style.setProperty("--chapter-header-height", `${height}px`);

    // The header is pinned, so prose scrolling past the top would otherwise
    // run underneath it. Keep a gutter wide enough for the two words —
    // measured off the labels themselves, not the whole header, so opening one
    // doesn't shove the prose sideways. The same gutter goes on the right,
    // which leaves the column centred; at comfortable window widths the column
    // is narrower than the space available and nothing moves at all.
    let labelWidth = 0;
    if (showHeader && headerEl) {
      for (const label of headerEl.querySelectorAll<HTMLElement>("[data-chapter-label]")) {
        labelWidth = Math.max(labelWidth, label.offsetWidth);
      }
    }
    const gutter = labelWidth ? labelWidth + PROSE_GUTTER_MIN * 2 : PROSE_GUTTER_MIN;
    container.style.setProperty("--prose-gutter", `${gutter}px`);
  }

  let container: HTMLDivElement;
  let view: EditorView | undefined;
  let highlightMenu = $state<{ x: number; y: number; from: number; to: number } | null>(null);

  /**
   * The formatting bar over a selection. Screen coordinates rather than
   * document offsets, because it's positioned against the selection's
   * rectangle on screen, which no document position can give directly.
   */
  let formatBar = $state<{ x: number; y: number } | null>(null);
  // Set while a formatting edit is dispatching, so the doc-change handler
  // below doesn't read our own edit as the writer typing and close the bar.
  let formatting = false;

  /** Which buttons should read as applied, recomputed whenever the bar shows. */
  let formatActive = $state<{ inline: Inline[]; block: Block | null }>({ inline: [], block: null });

  function refreshFormatState() {
    if (!view) return;
    const sel = view.state.selection.main;
    const text = view.state.doc.toString();
    const inline = (["bold", "italic", "strike"] as Inline[]).filter((k) =>
      isInlineActive(text, sel.from, sel.to, k),
    );
    const block = (["heading1", "heading2", "quote"] as Block[]).find((k) =>
      isBlockActive(text, sel.head, k),
    );
    formatActive = { inline, block: block ?? null };
  }

  /**
   * Puts the bar over the middle of the selection's top edge. Uses the live
   * DOM selection rather than CodeMirror coordinates, so a selection spanning
   * several wrapped lines is measured as the reader sees it.
   */
  function showFormatBar() {
    // Focus mode clears the toolbar, chapter list, word count and even the
    // highlights. A bar appearing on every selection would undo the point of it.
    if (!view || focusMode) return;
    const sel = view.state.selection.main;
    if (sel.empty) {
      formatBar = null;
      return;
    }
    const range = window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0) : null;
    const box = range?.getBoundingClientRect();
    if (!box || (box.width === 0 && box.height === 0)) {
      formatBar = null;
      return;
    }
    refreshFormatState();
    formatBar = { x: box.left + box.width / 2, y: box.top };
  }

  function applyInline(kind: Inline) {
    if (!view) return;
    const sel = view.state.selection.main;
    const edit = toggleInline(view.state.doc.toString(), sel.from, sel.to, kind);
    if (!edit) return;
    formatting = true;
    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: { anchor: edit.selectFrom, head: edit.selectTo },
    });
    view.focus();
    formatting = false;
    // Synchronously, not in an animation frame: frames stop when the window
    // isn't drawing, and then the buttons would keep showing the state the
    // text had before the edit.
    refreshFormatState();
    // Position is only cosmetic, so that part can wait for a frame.
    requestAnimationFrame(showFormatBar);
  }

  function applyBlock(kind: Block) {
    if (!view) return;
    const sel = view.state.selection.main;
    const edit = toggleBlock(view.state.doc.toString(), sel.from, kind, sel.to);
    formatting = true;
    view.dispatch({
      changes: { from: edit.from, to: edit.to, insert: edit.insert },
      selection: { anchor: edit.selectFrom, head: edit.selectTo },
    });
    view.focus();
    formatting = false;
    // The bar stays up with the same words selected, so a heading can be
    // taken off by pressing the same button again.
    refreshFormatState();
    requestAnimationFrame(showFormatBar);
  }

  // Lezer's markdown grammar re-verifies surrounding context on every edit (list
  // markers, headings, blockquotes etc. all hinge on word boundaries), and that
  // cost scales with document size. Measured on 2026-08-29: at 300,000
  // characters with the parser running, a keystroke costs 0.2ms median and
  // 0.6ms at worst, the same as with it switched off. At a million the editor
  // stops responding. The old 100,000 limit was set from a guess that turned
  // out to be pessimistic, and it had a visible cost: past it the Markdown
  // markers stopped being hidden, so a long chapter suddenly showed asterisks.
  //
  // 500,000 characters is roughly 85,000 words, far longer than any chapter,
  // and half the size at which trouble actually starts.
  const LARGE_DOC_THRESHOLD = 500_000;
  const languageCompartment = new Compartment();
  function languageExtensions(size: number) {
    return size > LARGE_DOC_THRESHOLD
      ? []
      : [
          // Markdown lets a line of dashes under a paragraph turn it into a
          // heading. A novelist types dashes constantly — starting a list, a
          // line of dialogue, a scene break — and watching the paragraph above
          // silently go bold is astonishing. `#` headings still work.
          markdown({
            // Strikethrough is GFM, not commonmark, so the parser needs it
            // added explicitly or `~~cut~~` stays as literal tildes.
            extensions: [{ remove: ["SetextHeading"] }, Strikethrough],
            // No list continuation on Enter. In a novel a line starting with a
            // dash is dialogue, not a bullet, and having Mari add another "- "
            // every time you break the line is worse than typing the odd list
            // marker yourself.
            addKeymap: false,
          }),
          syntaxHighlighting(proseHighlightStyle),
          // Only in a `.mari` chapter. A `.md` file is Markdown the writer
          // opened as Markdown, so its syntax stays visible.
          ...(plain ? [] : [hideMarkers()]),
        ];
  }

  // Highlight colours live in their own compartment so focus mode can drop
  // them without rebuilding the editor. The decorations themselves stay in
  // place — only their styling goes — so nothing is lost on the way out.
  const highlightThemeCompartment = new Compartment();
  function highlightThemeFor(hidden: boolean) {
    if (hidden) return [];
    return EditorView.theme(
      Object.fromEntries(HIGHLIGHT_STATES.map((s) => [`.cm-highlight-${s.id}`, { backgroundColor: s.rgba }])),
    );
  }
  let isLargeDoc = untrack(() => value).length > LARGE_DOC_THRESHOLD;

  // Serializing the whole document to a string is O(doc length); doing it on every
  // keystroke is what made typing scale badly with file size (fine at a few KB,
  // 10-25ms+ per keystroke at a couple hundred KB). Debounce it so typing itself
  // never blocks on it, and `lastEmitted` lets the sync-effect below skip a second
  // redundant serialization by comparing strings instead of re-deriving one.
  let syncTimeout: ReturnType<typeof setTimeout> | undefined;
  // Deliberately a one-time snapshot of the initial prop, not a reactive binding —
  // every later update goes through explicit assignment, not prop tracking.
  let lastEmitted: string = untrack(() => value);

  function scheduleSync() {
    if (syncTimeout) clearTimeout(syncTimeout);
    syncTimeout = setTimeout(() => {
      syncTimeout = undefined;
      if (!view) return;
      lastEmitted = view.state.doc.toString();
      onChange(lastEmitted);
      scheduleMinimapDraw();
    }, 200);
  }

  // For callers (e.g. Save) that need the true current content right now rather
  // than whatever's landed after the debounce — also flushes the pending timer so
  // it can't fire later with stale content and incorrectly flip `dirty` back on.
  export function getValue(): string {
    if (syncTimeout) {
      clearTimeout(syncTimeout);
      syncTimeout = undefined;
    }
    lastEmitted = view ? view.state.doc.toString() : value;
    return lastEmitted;
  }

  // Same one-time read as initialChunkHistory and initialChunkNotes below: the
  // field is seeded once when this instance is built, and every change after
  // that arrives as an effect.
  const highlightField = createHighlightField(untrack(() => initialHighlights));

  function extractHighlights(): HighlightRange[] {
    if (!view) return [];
    return readHighlights(view.state.field(highlightField), view.state.doc.length);
  }

  // Debounced like the content sync, and for the same reason: this is only ever
  // triggered by a deliberate menu click, not a keystroke, so 500ms of slack costs
  // nothing but avoids a redundant persist if the user is clicking through several
  // states in a row.
  let highlightsSyncTimeout: ReturnType<typeof setTimeout> | undefined;
  function scheduleHighlightsSync() {
    if (!onHighlightsChange) return;
    if (highlightsSyncTimeout) clearTimeout(highlightsSyncTimeout);
    highlightsSyncTimeout = setTimeout(() => {
      highlightsSyncTimeout = undefined;
      onHighlightsChange?.(extractHighlights());
    }, 500);
  }

  // For callers (Save, file-switch, app close) that need the current highlight
  // set flushed immediately rather than waiting on the debounce.
  export function flushHighlights(): HighlightRange[] {
    if (highlightsSyncTimeout) {
      clearTimeout(highlightsSyncTimeout);
      highlightsSyncTimeout = undefined;
    }
    return extractHighlights();
  }

  // Set by the caller just before it changes `value` to a different file's
  // content; consumed inside the value-sync effect below so the freshly-loaded
  // document and its restored highlights land in the same transaction — no
  // window where the doc exists without its highlights or vice versa.
  let pendingHighlights: HighlightRange[] | null = null;
  export function setPendingHighlights(highlights: HighlightRange[]) {
    pendingHighlights = highlights;
  }

  // Same idea as pendingHighlights, for the other file's chunk history.
  let pendingChunkHistory: Record<string, ChunkVersion[]> | null = null;
  export function setPendingChunkHistory(history: Record<string, ChunkVersion[]>) {
    pendingChunkHistory = history;
  }

  // ...and for its notes.
  let pendingChunkNotes: Record<string, string> | null = null;
  export function setPendingChunkNotes(notes: Record<string, string>) {
    pendingChunkNotes = notes;
  }

  /**
   * Puts the writer back on the line they were on. Asking the editor to scroll
   * to a position rather than setting a pixel offset ourselves: it knows how
   * to reach a line that hasn't been rendered yet, where a raw offset is only
   * as good as however much of the chapter happens to be laid out at the time.
   * A pixel offset would also be wrong after the window was resized.
   */
  function scrollToPlace(place: ViewPosition) {
    // Asks the editor to scroll rather than setting the scroll position
    // directly. Setting it directly loses: the editor re-measures after a
    // chapter is loaded and puts the view back to the top, undoing it.
    //
    // Twice, briefly apart. The first is for a chapter that is ready
    // immediately; the second covers a long one that is still being laid out,
    // where the first attempt has nothing to aim at yet.
    const goThere = () => {
      if (!view) return;
      // The line that was at the top goes back to the top — not the caret,
      // which may be nowhere near where they were reading.
      const target = Math.min(place.top ?? place.cursor, view.state.doc.length);
      view.dispatch({ effects: EditorView.scrollIntoView(target, { y: "start" }) });
    };
    setTimeout(goThere, 50);
    setTimeout(goThere, 300);
  }

  /**
   * Where the writer was in this chapter: the caret, and the first line they
   * could see. Both, because they aren't the same thing — you can scroll to
   * the end of a chapter without moving the caret from the first paragraph,
   * and it's the reading position that matters for putting you back.
   */
  export interface ViewPosition {
    cursor: number;
    /** Document position of the line at the top of the view. */
    top: number;
  }

  export function getViewPosition(): ViewPosition | null {
    if (!view) return null;
    const box = view.scrollDOM.getBoundingClientRect();
    // Asked for by screen position rather than worked out from the scroll
    // offset, so it stays right whatever the line heights are.
    const top = view.posAtCoords({ x: box.left + 8, y: box.top + 4 }, false);
    return { cursor: view.state.selection.main.head, top };
  }

  // Same idea as the pending highlights: set before the caller swaps `value`,
  // so the place is restored in step with the document rather than a tick
  // later, which would show the top of the chapter first and then jump.
  let pendingPosition: ViewPosition | null = null;
  export function setPendingPosition(position: ViewPosition | null) {
    pendingPosition = position;
  }

  function applyHighlight(stateId: string | null) {
    if (!view || !highlightMenu) return;
    const { from, to } = highlightMenu;

    // Preserve the chunk's id — and therefore any draft/version history
    // attached to it — when the marked range is unchanged; a genuinely new
    // selection gets a fresh id. Exact-range match is a deliberate
    // simplification: re-marking a chunk almost always means re-selecting the
    // same text, not a partial overlap.
    let id: string | undefined;
    view.state.field(highlightField).between(from, to, (dFrom, dTo, deco) => {
      if (dFrom === from && dTo === to) id = (deco.spec as { id?: string }).id;
    });
    id ??= crypto.randomUUID();
    view.dispatch({ effects: setHighlight.of({ from, to, stateId, id }) });
    scheduleHighlightsSync();
    drawMinimap();
    updateActiveChunk();
  }

  // --- Chunk drafting/versioning: draft an alternative for a highlighted
  // passage, compare it against the original, and either keep tweaking or
  // replace — with the replaced text kept forever as browsable history. See
  // HighlightState.chunkAction for which states allow starting a new draft.
  let chunkHistoryMap = $state<Record<string, ChunkVersion[]>>(untrack(() => initialChunkHistory));

  interface ActiveChunk {
    id: string;
    from: number;
    to: number;
    stateId: string;
    action: "draft" | "reposition" | "terminal";
  }
  // Short "what needs doing here" notes, keyed by chunk id so they survive
  // edits to the surrounding text.
  let chunkNotes = $state<Record<string, string>>(untrack(() => initialChunkNotes));
  let notePopover = $state<{ chunk: ActiveChunk; draft: string; left: number; top: number } | null>(null);
  let notePopoverEl = $state<HTMLDivElement | undefined>();

  function openNotePopover(chunk: ActiveChunk) {
    // The anchor position is snapshotted rather than read live: chunkIconPos
    // tracks hover/cursor state and drops to null as soon as the pointer
    // leaves the chunk, which would otherwise fling the open popover into the
    // top-left corner mid-edit.
    notePopover = {
      chunk,
      draft: chunkNotes[chunk.id] ?? "",
      left: (chunkIconPos?.left ?? 0) + 6,
      top: (chunkIconPos?.top ?? 0) + 30,
    };
  }

  function commitNote() {
    if (!notePopover) return;
    const { chunk, draft } = notePopover;
    notePopover = null;
    const trimmed = draft.trim().slice(0, CHUNK_NOTE_MAX_LENGTH);
    if (trimmed === (chunkNotes[chunk.id] ?? "")) return; // nothing actually changed
    const next = { ...chunkNotes };
    if (trimmed) next[chunk.id] = trimmed;
    else delete next[chunk.id];
    chunkNotes = next;
    onChunkNoteChange?.(chunk.id, trimmed || null);
  }

  // While the popover is open, a click anywhere outside it or a scroll of the
  // document closes it (saving first — there's no explicit Save any more).
  // Scrolling counts because the popover is anchored to a fixed screen spot,
  // so once the passage moves the popover no longer points at anything.
  $effect(() => {
    if (!notePopover) return;
    const onPointerDown = (event: MouseEvent) => {
      if (notePopoverEl && !notePopoverEl.contains(event.target as Node)) commitNote();
    };
    const onScroll = () => commitNote();
    window.addEventListener("mousedown", onPointerDown, true);
    const scroller = view?.scrollDOM;
    scroller?.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("mousedown", onPointerDown, true);
      scroller?.removeEventListener("scroll", onScroll);
    };
  });

  /** Drops a note outright — used when a Reposition move retires its chunk. */
  function deleteNoteFor(chunkId: string) {
    if (!(chunkId in chunkNotes)) return;
    const next = { ...chunkNotes };
    delete next[chunkId];
    chunkNotes = next;
    onChunkNoteChange?.(chunkId, null);
  }

  // One icon at a time, for the chunk the mouse is over or the cursor sits in.
  let cursorChunk: ActiveChunk | null = null;
  let hoverChunk: ActiveChunk | null = null;
  let activeChunk = $state<ActiveChunk | null>(null);
  let chunkIconPos = $state<{ left: number; top: number } | null>(null);
  let draftPanel = $state<{ chunk: ActiveChunk; originalText: string } | null>(null);
  let hoverClearTimeout: ReturnType<typeof setTimeout> | undefined;

  // Resolved here rather than inline in the template: `{@const}` inside the
  // `{#if}` doesn't narrow the nullable state for the type checker.
  const activeChunkState = $derived(
    activeChunk ? HIGHLIGHT_STATES.find((s) => s.id === activeChunk!.stateId) : undefined,
  );

  // A decided state with nothing recorded against it (Good / Cut / OK for
  // now, before any history exists) has no action worth offering, so its row
  // is just the state's name — no buttons.
  const activeChunkNameOnly = $derived(
    !!activeChunk && activeChunk.action === "terminal" && !chunkHistoryMap[activeChunk.id]?.length,
  );

  const ICON_MARGIN = 8;

  function chunkFromDeco(from: number, to: number, deco: Decoration): ActiveChunk | null {
    const spec = deco.spec as { class?: string; id?: string };
    const cls = spec.class ?? "";
    if (!cls.startsWith("cm-highlight-")) return null;
    const stateId = cls.slice("cm-highlight-".length);
    const stateInfo = HIGHLIGHT_STATES.find((s) => s.id === stateId);
    if (!stateInfo || !spec.id) return null;
    return { id: spec.id, from, to, stateId, action: stateInfo.chunkAction };
  }

  function findChunkAtPos(pos: number): ActiveChunk | null {
    if (!view) return null;
    let found: ActiveChunk | null = null;
    view.state.field(highlightField).between(pos, pos, (from, to, deco) => {
      if (!found) found = chunkFromDeco(from, to, deco);
    });
    return found;
  }

  function findChunkById(id: string): ActiveChunk | null {
    if (!view) return null;
    let found: ActiveChunk | null = null;
    view.state.field(highlightField).between(0, view.state.doc.length, (from, to, deco) => {
      if (found) return;
      const chunk = chunkFromDeco(from, to, deco);
      if (chunk?.id === id) found = chunk;
    });
    return found;
  }

  function updateChunkIconPos() {
    if (!view || !activeChunk) {
      chunkIconPos = null;
      return;
    }
    // Deliberately uses the layout-tracked line blocks rather than
    // coordsAtPos: coordsAtPos returns null for any position CodeMirror
    // hasn't rendered, which is exactly what happens once you scroll into a
    // chunk taller than the viewport — its start scrolls out of the rendered
    // range and the icon vanished mid-passage. Block layout is always known.
    const startTop = view.documentTop + view.lineBlockAt(activeChunk.from).top;
    const endBottom = view.documentTop + view.lineBlockAt(activeChunk.to).bottom;
    const scrollerRect = view.scrollDOM.getBoundingClientRect();
    // Only hide once the whole chunk is off-screen, either direction.
    if (endBottom < scrollerRect.top || startTop > scrollerRect.bottom) {
      chunkIconPos = null;
      return;
    }
    // Anchored to the chunk's top line, but clamped into the visible band so a
    // long chunk keeps a reachable icon the whole way down.
    const top = Math.min(
      Math.max(startTop, scrollerRect.top + ICON_MARGIN),
      scrollerRect.bottom - ICON_MARGIN - 16,
    );
    const contentRect = view.contentDOM.getBoundingClientRect();
    chunkIconPos = { left: contentRect.right, top };
  }

  /** Hover wins over cursor; either can put the row on screen. */
  function refreshChunkIcon() {
    const chunk = hoverChunk ?? cursorChunk;
    if (!chunk) {
      activeChunk = null;
      chunkIconPos = null;
      return;
    }
    activeChunk = chunk;
    updateChunkIconPos();
  }

  function updateActiveChunk() {
    if (!view) return;
    cursorChunk = findChunkAtPos(view.state.selection.main.head);
    refreshChunkIcon();
  }

  function setHoverChunk(chunk: ActiveChunk | null) {
    if (chunk?.id === hoverChunk?.id) return;
    hoverChunk = chunk;
    refreshChunkIcon();
  }

  // Reaching for the icon takes the pointer out of the text, which would
  // otherwise clear the hover and yank the icon away mid-reach — so hover-off
  // only lands after a short grace period the icon itself can cancel.
  function scheduleHoverClear() {
    cancelHoverClear();
    hoverClearTimeout = setTimeout(() => {
      hoverClearTimeout = undefined;
      setHoverChunk(null);
    }, 260);
  }

  function cancelHoverClear() {
    if (hoverClearTimeout) {
      clearTimeout(hoverClearTimeout);
      hoverClearTimeout = undefined;
    }
  }

  function recordChunkVersion(chunkId: string, version: ChunkVersion) {
    chunkHistoryMap = { ...chunkHistoryMap, [chunkId]: [...(chunkHistoryMap[chunkId] ?? []), version] };
    onChunkHistoryChange?.(chunkId, version);
  }

  function handleChunkIconClick() {
    if (!view || !activeChunk) return;
    if (activeChunk.action === "reposition") {
      startPlacementMode(activeChunk);
      return;
    }
    draftPanel = { chunk: activeChunk, originalText: view.state.sliceDoc(activeChunk.from, activeChunk.to) };
  }

  /**
   * Replacing is the writer saying the rewrite is done, so the mark that asked
   * for it goes with it — leaving it would put a to-do on work already
   * finished. `keepState` overrides that: a state id re-marks the new wording,
   * and "keep" leaves the existing mark alone (restoring an old version isn't
   * finishing anything).
   */
  function handleDraftReplace(newText: string, keepState: string | null | "keep") {
    if (!view || !draftPanel) return;
    const { chunk, originalText } = draftPanel;

    view.dispatch({
      changes: { from: chunk.from, to: chunk.to, insert: newText },
      // Cleared in the same transaction as the replacement, so there's no
      // moment where the mark sits over half-replaced text.
      effects: keepState === "keep" ? [] : [clearHighlightById.of(chunk.id)],
    });

    if (keepState && keepState !== "keep") {
      // The old mark is gone, so this is a fresh one over exactly the new
      // wording — same id, so the passage keeps its draft history.
      const to = chunk.from + newText.length;
      view.dispatch({ effects: setHighlight.of({ from: chunk.from, to, stateId: keepState, id: chunk.id }) });
    }

    recordChunkVersion(chunk.id, {
      id: crypto.randomUUID(),
      text: originalText,
      createdAt: new Date().toISOString(),
      kind: "draft",
    });
    scheduleHighlightsSync();
    drawMinimap();
    draftPanel = null;
  }

  // --- Reposition: a staged move rather than cut/paste. The chunk stays in
  // the document (still readable, never actually gone) while placement mode
  // is armed; only the click on a target commits both the delete and the
  // insert as one transaction, so a single Ctrl+Z undoes the whole move.
  interface PlacementState {
    chunkId: string;
    from: number;
    to: number;
    text: string;
    preview: string;
  }
  let placementMode = $state<PlacementState | null>(null);
  let placementTargetPos: number | null = null; // doc position; not reactive, only read at click time
  let placementIndicatorPos = $state<{ left: number; top: number; width: number } | null>(null);

  // Removes the window-level dismiss listeners registered while placement mode
  // is armed; see startPlacementMode for why they exist.
  let placementDismiss: (() => void) | undefined;

  function startPlacementMode(chunk: ActiveChunk) {
    if (!view) return;
    const text = view.state.sliceDoc(chunk.from, chunk.to);
    placementMode = { chunkId: chunk.id, from: chunk.from, to: chunk.to, text, preview: text.slice(0, 60) };
    activeChunk = null;
    chunkIconPos = null;

    // A click landing outside the editor (toolbar, sidebar, the banner
    // itself), or Escape pressed while the editor isn't focused, has to be
    // able to cancel too. Without this, placement mode could stay armed
    // invisibly — and because the chunk icon hides whenever it's set, *no*
    // chunk would show its icon again for the rest of the session.
    const onMouseDown = (event: MouseEvent) => {
      if (view && !view.dom.contains(event.target as Node)) abandonPlacementMode();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") abandonPlacementMode();
    };
    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("keydown", onKeyDown, true);
    placementDismiss = () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("keydown", onKeyDown, true);
    };
  }

  function cancelPlacementMode() {
    placementMode = null;
    placementTargetPos = null;
    placementIndicatorPos = null;
    placementDismiss?.();
    placementDismiss = undefined;
  }

  /** Cancel + put the chunk's icon back, for the "user gave up" paths. */
  function abandonPlacementMode() {
    cancelPlacementMode();
    updateActiveChunk();
  }

  /** The line-start this click/hover would drop the chunk at, or null if it isn't a valid target. */
  function placementTargetAt(editorView: EditorView, clientX: number, clientY: number): number | null {
    if (!placementMode) return null;
    const pos = editorView.posAtCoords({ x: clientX, y: clientY });
    if (pos == null) return null;
    const snapPos = editorView.state.doc.lineAt(pos).from;
    // Inside the staged chunk's own range isn't a valid drop target.
    if (snapPos >= placementMode.from && snapPos <= placementMode.to) return null;
    return snapPos;
  }

  function performMove(editorView: EditorView) {
    if (!placementMode || placementTargetPos == null) return;
    const { chunkId, from, to, text } = placementMode;
    const target = placementTargetPos;
    // Clear before dispatching — the updateListener's auto-cancel-on-typing
    // check then sees placementMode already null for this transaction, so it
    // doesn't (redundantly, harmlessly) re-cancel what just completed.
    cancelPlacementMode();

    const changes = [
      { from, to, insert: "" },
      { from: target, to: target, insert: text },
    ].sort((a, b) => a.from - b.from);
    editorView.dispatch({ changes, effects: clearHighlightById.of(chunkId) });

    recordChunkVersion(chunkId, {
      id: crypto.randomUUID(),
      text,
      createdAt: new Date().toISOString(),
      kind: "moved",
    });
    // The move retires the mark, so the note goes with it — otherwise it would
    // linger in storage attached to a chunk nothing can reach any more.
    deleteNoteFor(chunkId);
    updateActiveChunk();
    drawMinimap();
  }

  // --- Minimap: a canvas rendering of the document, VS Code style — bars per
  // real text (muted color for plain, solid highlight color where marked),
  // rendered small-but-legible to an offscreen canvas and then scaled *down*
  // in one drawImage call — the same trick VS Code's real minimap uses,
  // letting the browser's own image-downscaling blur/anti-alias it into
  // something that reads as smoothed text instead of a grid of blocks (which
  // hand-drawn per-character marks looked like no matter how they were sized).
  // A prior version used a second CodeMirror instance shrunk via CSS transform
  // (see src/lib/components/_archive/); it looked authentic but had no
  // scrollable container of its own, so CodeMirror couldn't virtualize it —
  // every line became a real DOM node at once, which pegged the CPU on large
  // documents. This has no such ceiling: cost scales with pixels drawn, not
  // document length, whether hand-drawing marks or rendering real text.
  // Reactive because focus mode removes and re-creates the element, so
  // `bind:this` reassigns it and anything depending on it has to notice.
  let minimapCanvas = $state<HTMLCanvasElement | undefined>();
  const MINIMAP_WIDTH_PX = 120;
  const MINIMAP_MARGIN_PX = 16;
  const MINIMAP_CHARS_PER_ROW = 66; // matches the main editor's ~66ch column
  const MINIMAP_SOURCE_WIDTH = 560; // offscreen render width, ~66 chars at the font size below
  const MINIMAP_SOURCE_FONT_SIZE = 9;
  const MINIMAP_SOURCE_ROW_HEIGHT = 11;
  const MINIMAP_MAX_SOURCE_HEIGHT = 16_000; // stays safely under browser canvas-size limits
  // Higher than the real editor's own highlight opacity (0.15-0.22) — a bar
  // only a few pixels tall needs more contrast than a full line-height block
  // does to still read clearly after the downscale blur.
  const MINIMAP_HIGHLIGHT_ALPHA = 0.55;

  let minimapBoxLeftPx = $state(0);
  let minimapBoxTopPx = $state(0);
  // The viewport indicator is positioned imperatively rather than through a
  // reactive style binding. It moves on every scroll event, and rewriting
  // `top`/`height` invalidates layout — which, with wrapped proportional text
  // in the editor, means the browser re-lays-out prose on every scroll frame.
  // A `transform` moves it on the compositor instead, touching no layout, and
  // going straight to the DOM skips a Svelte scheduler pass per scroll event.
  let minimapViewportEl = $state<HTMLDivElement | undefined>();
  let minimapViewportTopPx = 0;
  let minimapViewportHeightPx = 0;
  // Set at the end of every drawMinimap() call; the viewport indicator's
  // proportions are relative to it, so scroll updates alone (no full redraw)
  // can still position it correctly between redraws.
  let minimapCanvasHeightCss = 0;
  // Not reactive — read back only inside handleMinimapClick, immediately after
  // the draw that produced them; no template binds to these.
  let minimapPixelsPerRow = 1;
  let minimapLineStartRows: number[] = []; // cumulative visual-row offset of each logical line
  let minimapResizeObserver: ResizeObserver | undefined;
  let minimapDrawTimeout: ReturnType<typeof setTimeout> | undefined;

  // A full redraw is O(document length), so on a novel it costs real time even
  // after the per-token measuring was removed. Two things keep it off your
  // way: a debounce long enough to sit out the short pauses that happen
  // mid-sentence, and running the draw itself in idle time so it can never
  // land in the middle of a keystroke or a scroll frame.
  let minimapIdleHandle: number | undefined;
  function cancelScheduledMinimapDraw() {
    if (minimapDrawTimeout) {
      clearTimeout(minimapDrawTimeout);
      minimapDrawTimeout = undefined;
    }
    if (minimapIdleHandle !== undefined) {
      const cancelIdle = (window as unknown as { cancelIdleCallback?: (h: number) => void }).cancelIdleCallback;
      if (cancelIdle) cancelIdle(minimapIdleHandle);
      else clearTimeout(minimapIdleHandle);
      minimapIdleHandle = undefined;
    }
  }

  function scheduleMinimapDraw() {
    cancelScheduledMinimapDraw();
    minimapDrawTimeout = setTimeout(() => {
      minimapDrawTimeout = undefined;
      // requestIdleCallback isn't available in every webview this ships to
      // (WebKitGTK notably), so fall back to a plain timeout there.
      const requestIdle = (
        window as unknown as {
          requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
        }
      ).requestIdleCallback;
      if (requestIdle) {
        minimapIdleHandle = requestIdle(
          () => {
            minimapIdleHandle = undefined;
            drawMinimap();
          },
          { timeout: 1000 },
        );
      } else {
        minimapIdleHandle = setTimeout(() => {
          minimapIdleHandle = undefined;
          drawMinimap();
        }, 0) as unknown as number;
      }
    }, 500);
  }

  // Greedily packs words onto each row until the next word would overflow
  // maxWidth, mirroring how the real editor wraps by pixel width rather than
  // by character count — a fixed character count doesn't work here because
  // the minimap draws in the real proportional prose font, where a 66-char
  // chunk's actual rendered width varies with its content, leaving a
  // different (wrong) amount of empty space on the right of every row.
  // Token width is estimated from an average character width rather than
  // measured per token. Measuring was costing ~75ms of every redraw on a
  // novel-length document (~60k measureText calls) — and since the result is
  // downscaled to a 120px-wide blur, the difference in wrap points is
  // invisible. The estimate is what keeps redraws off the main thread budget.
  function drawMinimap() {
    if (!view || !minimapCanvas || !container) return;
    const ctx = minimapCanvas.getContext("2d");
    if (!ctx) return;
    const containerRect = container.getBoundingClientRect();
    const availableHeight = containerRect.height - MINIMAP_MARGIN_PX * 2;
    if (availableHeight <= 0) return;

    const doc = view.state.doc;
    const lineCount = doc.lines;

    // Rough char-count estimate, only to pick a compression/font-size ratio
    // before we know the real font metrics — precision doesn't matter here,
    // it just needs to be in the right ballpark.
    let estimatedRows = 0;
    for (let i = 1; i <= lineCount; i++) {
      estimatedRows += Math.max(1, Math.ceil(doc.line(i).length / MINIMAP_CHARS_PER_ROW));
    }
    estimatedRows = Math.max(1, estimatedRows);

    minimapBoxLeftPx = containerRect.width - MINIMAP_WIDTH_PX - MINIMAP_MARGIN_PX;
    minimapBoxTopPx = MINIMAP_MARGIN_PX;

    // Render real text at a small-but-legible size onto an offscreen canvas,
    // then downscale the whole thing in one drawImage call at the end — the
    // browser's own image interpolation does the blur/anti-alias that makes
    // this read as smoothed text rather than the hard-edged blocks that
    // hand-drawn per-character rectangles produced regardless of sizing.
    // Once a document needs more rows than fit under the height cap, the font
    // size has to shrink right along with the row spacing — shrinking only the
    // spacing while still drawing at full font size is what was causing
    // adjacent lines to overlap and garble in longer documents.
    const compression = Math.min(1, MINIMAP_MAX_SOURCE_HEIGHT / (estimatedRows * MINIMAP_SOURCE_ROW_HEIGHT));
    const sourceRowHeight = MINIMAP_SOURCE_ROW_HEIGHT * compression;
    const sourceFontSize = MINIMAP_SOURCE_FONT_SIZE * compression;
    const source = document.createElement("canvas");
    source.width = MINIMAP_SOURCE_WIDTH;
    source.height = 1; // resized below once the real row count is known
    const sctx = source.getContext("2d");
    if (!sctx) return;
    const fontFamily = getComputedStyle(container).getPropertyValue("--font-prose").trim() || "serif";
    sctx.font = `${sourceFontSize}px ${fontFamily}`;
    sctx.textBaseline = "top";

    // Wrap on word boundaries at the real column width, so every non-final
    // row fills its width the way the editor's own word-wrap does. Width per
    // token is estimated from one measurement of a representative sample
    // rather than measured token by token — see wrapLineIntoRows.
    // Sample the document's own text rather than a synthetic alphabet — a
    // made-up sample skews wide (real prose is mostly lowercase), which
    // shrinks the character budget and wraps every row short of the column.
    const sampleStart = Math.min(doc.length, 2000);
    const widthSample = doc.sliceString(0, sampleStart).replace(/\n/g, " ") || "the quick brown fox ";
    const avgCharWidth = Math.max(0.01, sctx.measureText(widthSample).width / widthSample.length);

    const lineRows: { from: number; to: number }[][] = new Array(lineCount + 1);
    minimapLineStartRows = new Array(lineCount + 1);
    let totalRows = 0;
    for (let i = 1; i <= lineCount; i++) {
      const rows = wrapLineIntoRows(doc.line(i).text, MINIMAP_SOURCE_WIDTH, avgCharWidth);
      lineRows[i] = rows;
      minimapLineStartRows[i] = totalRows;
      totalRows += rows.length;
    }
    totalRows = Math.max(1, totalRows);

    const pixelsPerRow = Math.min(3, availableHeight / totalRows);
    minimapPixelsPerRow = pixelsPerRow;
    const canvasHeightCss = Math.min(availableHeight, totalRows * pixelsPerRow);
    const sourceHeight = Math.max(1, Math.ceil(totalRows * sourceRowHeight));
    source.height = sourceHeight;
    // Resizing the canvas element resets its context state, so the font has
    // to be reapplied before drawing.
    sctx.font = `${sourceFontSize}px ${fontFamily}`;
    sctx.textBaseline = "top";

    const baseColor = getComputedStyle(container).getPropertyValue("--color-text-muted").trim() || "#8a8f98";
    const highlights = view.state.field(highlightField);

    for (let i = 1; i <= lineCount; i++) {
      const line = doc.line(i);
      const rows = lineRows[i];
      for (let r = 0; r < rows.length; r++) {
        const y = (minimapLineStartRows[i] + r) * sourceRowHeight;
        if (y > sourceHeight) return;
        const { from: chunkStart, to: chunkEnd } = rows[r];
        if (chunkEnd <= chunkStart) continue;
        const chunkText = line.text.slice(chunkStart, chunkEnd);
        const chunkAbsFrom = line.from + chunkStart;

        // Split the chunk into highlighted/plain runs. Highlights are drawn as
        // a solid background bar behind the (still muted-color) text rather
        // than as colored glyphs — at this size, colored text is just a few
        // pixels of anti-aliased stroke that the downscale blur washes out
        // almost completely, whereas a filled rectangle survives it fine.
        const runs: { from: number; to: number; bg: string | null }[] = [];
        highlights.between(chunkAbsFrom, chunkAbsFrom + chunkText.length, (hFrom, hTo, deco) => {
          const cls = (deco.spec as { class?: string }).class ?? "";
          if (!cls.startsWith("cm-highlight-")) return;
          const stateInfo = HIGHLIGHT_STATES.find((s) => s.id === cls.slice("cm-highlight-".length));
          if (!stateInfo) return;
          runs.push({
            from: Math.max(0, hFrom - chunkAbsFrom),
            to: Math.min(chunkText.length, hTo - chunkAbsFrom),
            bg: withAlpha(stateInfo.rgba, MINIMAP_HIGHLIGHT_ALPHA),
          });
        });
        runs.sort((a, b) => a.from - b.from);

        let pos = 0;
        let x = 0;
        for (const run of runs) {
          if (run.from > pos) {
            const segment = chunkText.slice(pos, run.from);
            sctx.fillStyle = baseColor;
            sctx.fillText(segment, x, y);
            x += sctx.measureText(segment).width;
          }
          const segment = chunkText.slice(run.from, run.to);
          const segmentWidth = sctx.measureText(segment).width;
          if (run.bg) {
            sctx.fillStyle = run.bg;
            sctx.fillRect(x, y, segmentWidth, sourceRowHeight);
          }
          sctx.fillStyle = baseColor;
          sctx.fillText(segment, x, y);
          x += segmentWidth;
          pos = run.to;
        }
        if (pos < chunkText.length) {
          sctx.fillStyle = baseColor;
          sctx.fillText(chunkText.slice(pos), x, y);
        }
      }
    }

    const dpr = window.devicePixelRatio || 1;
    minimapCanvas.style.width = `${MINIMAP_WIDTH_PX}px`;
    minimapCanvas.style.height = `${canvasHeightCss}px`;
    minimapCanvas.width = Math.max(1, Math.round(MINIMAP_WIDTH_PX * dpr));
    minimapCanvas.height = Math.max(1, Math.round(canvasHeightCss * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, MINIMAP_WIDTH_PX, canvasHeightCss);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, 0, 0, MINIMAP_SOURCE_WIDTH, sourceHeight, 0, 0, MINIMAP_WIDTH_PX, canvasHeightCss);

    minimapCanvasHeightCss = canvasHeightCss;
    updateMinimapViewport();
  }

  // Positions the "currently visible" indicator rectangle, VS Code style.
  // The minimap always renders the whole document top-to-bottom (it never
  // scrolls independently), so the indicator is just the editor's own scroll
  // fraction mapped onto the minimap's height.
  function updateMinimapViewport() {
    if (!view) return;
    const scroller = view.scrollDOM;
    const scrollHeight = scroller.scrollHeight;
    if (scrollHeight <= 0 || minimapCanvasHeightCss <= 0) return;
    const indicator = viewportIndicator(
      scroller.scrollTop,
      scrollHeight,
      scroller.clientHeight,
      minimapCanvasHeightCss,
    );
    minimapViewportTopPx = indicator.top;
    minimapViewportHeightPx = indicator.height;
    const el = minimapViewportEl;
    if (!el) return;
    el.style.transform = `translateY(${minimapViewportTopPx}px)`;
    // Height barely moves while scrolling (it tracks the viewport/document
    // ratio), so only write it when it actually changes — that keeps the
    // layout-invalidating property off the scroll path.
    const nextHeight = `${Math.round(minimapViewportHeightPx)}px`;
    if (el.style.height !== nextHeight) el.style.height = nextHeight;
  }

  function handleMinimapClick(event: MouseEvent) {
    if (!view || !minimapCanvas || minimapPixelsPerRow <= 0) return;
    const rect = minimapCanvas.getBoundingClientRect();
    const clickedRow = (event.clientY - rect.top) / minimapPixelsPerRow;
    // minimapLineStartRows is ascending — find the last line starting at or
    // before the clicked row (binary search; this can be a few thousand
    // entries for a long document, and it runs on every click).
    let lo = 1;
    let hi = view.state.doc.lines;
    while (lo < hi) {
      const mid = Math.ceil((lo + hi) / 2);
      if (minimapLineStartRows[mid] <= clickedRow) lo = mid;
      else hi = mid - 1;
    }
    const pos = view.state.doc.line(lo).from;
    view.dispatch({ selection: { anchor: pos }, effects: EditorView.scrollIntoView(pos, { y: "center" }) });
    view.focus();
  }

  /**
   * Cutting to the panel and putting back are filing actions, not text edits,
   * and they're each other's undo. Ctrl+Z can only revert the document half —
   * it knows nothing about the panel — which would leave the passage either
   * duplicated (in the prose *and* the panel) or, undoing a Put back, gone
   * from both. Keeping these out of the history means the only way to reverse
   * one is the other, and the two halves can't drift apart.
   */
  const notUndoable = Transaction.addToHistory.of(false);

  let drawerOpen = $state(false);
  let drawerEl = $state<HTMLDivElement | undefined>();

  // Clicking anywhere else shuts the drawer, like the other two header panels.
  // The header is excluded because the word that opens this also closes it —
  // otherwise the two would fight and it would never shut.
  $effect(() => {
    if (!drawerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (drawerEl?.contains(target) || headerEl?.contains(target)) return;
      drawerOpen = false;
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  });

  /**
   * A quiet copy button sitting just past the last line, right-aligned to the
   * prose. Only worth offering on a chapter longer than the screen: on a short
   * one you can select the lot in a gesture, and the button would just be
   * something extra under the writing.
   */
  let copyDocPos = $state<{ left: number; top: number } | null>(null);
  let copiedDocument = $state(false);
  let copiedDocumentTimer: ReturnType<typeof setTimeout> | undefined;

  function updateCopyDocPos() {
    if (!view || focusMode) {
      copyDocPos = null;
      return;
    }
    const scroller = view.scrollDOM;
    // A screenful or less: nothing to scroll, so no button.
    if (scroller.scrollHeight <= scroller.clientHeight + 1) {
      copyDocPos = null;
      return;
    }

    // Line blocks rather than coordsAtPos, for the same reason as the passage
    // icons: coordsAtPos is null for anything CodeMirror hasn't rendered, and
    // the end of a long chapter usually hasn't been.
    const endBottom = view.documentTop + view.lineBlockAt(view.state.doc.length).bottom;
    const scrollerRect = scroller.getBoundingClientRect();
    // Only once the end of the writing is actually in view.
    if (endBottom < scrollerRect.top || endBottom > scrollerRect.bottom) {
      copyDocPos = null;
      return;
    }

    const contentRect = view.contentDOM.getBoundingClientRect();
    copyDocPos = { left: contentRect.right - COPY_DOC_SIZE, top: endBottom + COPY_DOC_GAP };
  }

  const COPY_DOC_SIZE = 22;
  const COPY_DOC_GAP = 14;

  async function copyWholeDocument() {
    if (!view) return;
    await copyText(view.state.doc.toString());
    copiedDocument = true;
    clearTimeout(copiedDocumentTimer);
    copiedDocumentTimer = setTimeout(() => (copiedDocument = false), 1500);
  }

  /**
   * Takes the passage out of the chapter and puts it in the drawer. The
   * highlight goes with it, since there's no longer any text to colour.
   */
  function cutToPanel(from: number, to: number) {
    if (!view) return;
    const cut = describeCut(view.state.doc.toString(), from, to);
    if (!cut) return; // nothing worth keeping in the selection

    // Marks inside the removed range go with it; CodeMirror maps the rest.
    view.dispatch({
      changes: { from, to, insert: "" },
      selection: { anchor: from },
      annotations: notUndoable,
    });
    onCutsChange?.([...cuts, cut]);
  }

  /**
   * Puts a passage back where it came from. The remembered context is only
   * trusted when it appears exactly once — otherwise there's no telling which
   * copy is the right one, and dropping it at the cursor is honest about that.
   */
  function putBackCut(cut: MariCut) {
    if (!view) return;
    const at = findPutBackPosition(
      view.state.doc.toString(),
      cut,
      view.state.selection.main.head,
    );

    view.dispatch({
      changes: { from: at, insert: cut.text },
      selection: { anchor: at + cut.text.length },
      effects: EditorView.scrollIntoView(at, { y: "center" }),
      annotations: notUndoable,
    });
    onCutsChange?.(cuts.filter((c) => c.id !== cut.id));
    view.focus();
  }

  const highlightMenuItems: ContextMenuItem[] = [
    ...HIGHLIGHT_STATES.map((s, i) => ({
      label: s.label,
      colorSwatch: s.solid,
      shortcut: `Alt+${i + 1}`,
      onClick: () => applyHighlight(s.id),
    })),
    { label: "Clear highlight", danger: true, shortcut: "Alt+0", onClick: () => applyHighlight(null) },
  ];

  /**
   * Undo, redo and select-all, matched by where the key sits rather than the
   * character it produces.
   *
   * CodeMirror matches its own bindings against the character, falling back to
   * the legacy `keyCode` when that character isn't Latin. But `keyCode` is
   * deprecated and some webviews leave it at zero — and then undo simply stops
   * working the moment the writer switches to a Cyrillic layout.
   *
   * This runs after CodeMirror's keymap, so on layouts where its own matching
   * works this is never reached and nothing happens twice.
   */
  function handleEditingShortcut(event: KeyboardEvent, editorView: EditorView): boolean {
    if (!(event.ctrlKey || event.metaKey) || event.altKey) return false;

    // Only for keys that produce something other than a Latin letter. A Latin
    // letter is matched by the editor's own binding whatever its position, and
    // stepping in would get it wrong on the layouts that move letters about:
    // on a German keyboard the Z key sits where Y is on a US one, so matching
    // by position would turn its undo into a redo.
    if (/^[a-z]$/i.test(event.key)) return false;

    switch (event.code) {
      case "KeyZ":
        event.preventDefault();
        return event.shiftKey ? redo(editorView) : undo(editorView);
      case "KeyY":
        if (event.shiftKey) return false;
        event.preventDefault();
        return redo(editorView);
      case "KeyA":
        if (event.shiftKey) return false;
        event.preventDefault();
        return selectAll(editorView);
      default:
        return false;
    }
  }

  /**
   * Alt+1..8 marks, Alt+0 clears. Alt rather than Ctrl because Ctrl+1..8 is
   * tab switching in browsers and is reserved — the page never reliably gets
   * it, which would leave the web build without these.
   *
   * With no selection the whole paragraph is marked: most marks are
   * paragraph-level, and demanding a selection first throws away most of the
   * speed this is for. Re-pressing a chunk's own state clears it.
   */
  function handleHighlightShortcut(event: KeyboardEvent): boolean {
    if (plain) return false; // marks belong to .mari documents
    if (!view || !event.altKey || event.ctrlKey || event.metaKey) return false;
    // Matched on `code`, not `key`: with Alt held, many keyboard layouts report
    // something other than the plain digit in `key` (accented characters, dead
    // keys), which made the shortcut silently do nothing. `code` names the
    // physical key regardless of layout or modifiers.
    const digit = /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
    if (digit === undefined) return false;
    const slot = Number(digit);
    if (slot > HIGHLIGHT_STATES.length) return false;

    const sel = view.state.selection.main;
    let from: number;
    let to: number;
    if (sel.empty) {
      const line = view.state.doc.lineAt(sel.head);
      if (!line.text.trim()) return false; // blank line — nothing to mark
      from = line.from;
      to = line.to;
    } else {
      from = sel.from;
      to = sel.to;
    }

    const stateId = slot === 0 ? null : HIGHLIGHT_STATES[slot - 1].id;
    // Pressing a chunk's own state again clears it, so one key both sets and
    // unsets rather than needing a separate undo key.
    const existing = findChunkAtPos(from === to ? from : from + 1);
    const nextStateId = stateId && existing?.stateId === stateId && existing.from === from && existing.to === to
      ? null
      : stateId;

    highlightMenu = { x: 0, y: 0, from, to };
    applyHighlight(nextStateId);
    highlightMenu = null;
    return true;
  }

  onMount(() => {
    view = new EditorView({
      parent: container,
      state: EditorState.create({
        doc: value,
        extensions: [
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap]),
          languageCompartment.of(languageExtensions(value.length)),
          // Outside the compartment above: copying formatted text doesn't need
          // the parser, so it shouldn't switch off with it in a long document.
          richCopy(),
          EditorView.lineWrapping,
          placeholderExt("Start writing..."),
          // WebKitGTK's spellcheck engine (enchant/hunspell) does expensive
          // dictionary/suggestion work on every edit inside contentEditable regions;
          // for a code-editor-style surface this is pure overhead, not a feature.
          EditorView.contentAttributes.of({ spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
          highlightField,
          EditorView.domEventHandlers({
            // On mouseup rather than on every selection change: extending a
            // selection with Shift+arrow would otherwise make the bar jump
            // about mid-keystroke. Deferred a tick because the DOM selection
            // isn't settled yet while the event is being handled.
            mouseup: () => {
              // Not gated on `plain`: that flag means "no highlights here",
              // but bold and italic are just Markdown, and `.md` and `.docx`
              // documents carry them perfectly well.
              setTimeout(showFormatBar, 0);
              return false;
            },
            contextmenu: (event, editorView) => {
              if (plain) return false; // no marking in a plain text document
              const sel = editorView.state.selection.main;
              if (sel.empty) return false;
              event.preventDefault();
              // Without this, the event keeps bubbling to window after preventDefault()
              // — and since ContextMenu listens on window for contextmenu-to-dismiss, it
              // would catch this same event and close the menu instantly.
              event.stopPropagation();
              highlightMenu = { x: event.clientX, y: event.clientY, from: sel.from, to: sel.to };
              return true;
            },
            // mouseover (not mouseenter) because it bubbles up from the
            // individual highlight spans, so one handler on the content covers
            // every chunk without per-element listeners.
            mouseover: (event) => {
              if (placementMode) return false;
              const target = event.target as HTMLElement | null;
              const el = target?.closest?.("[data-chunk-id]") as HTMLElement | null;
              const id = el?.getAttribute("data-chunk-id");
              if (id) {
                cancelHoverClear();
                setHoverChunk(findChunkById(id));
              } else if (hoverChunk) {
                scheduleHoverClear();
              }
              return false;
            },
            mouseleave: () => {
              if (hoverChunk) scheduleHoverClear();
              return false;
            },
            mousemove: (event, editorView) => {
              if (!placementMode) return false;
              const target = placementTargetAt(editorView, event.clientX, event.clientY);
              placementTargetPos = target;
              if (target == null) {
                placementIndicatorPos = null;
                return false;
              }
              const coords = editorView.coordsAtPos(target);
              if (coords) {
                const editorRect = editorView.dom.getBoundingClientRect();
                placementIndicatorPos = { left: editorRect.left, top: coords.top, width: editorRect.width };
              }
              return false;
            },
            mousedown: (event, editorView) => {
              if (!placementMode) return false;
              // Resolve the target from this click's own coordinates rather
              // than trusting a previous mousemove — a click arriving without
              // one used to fall through silently and leave placement mode
              // armed forever, hiding every chunk's icon from then on.
              const target = placementTargetAt(editorView, event.clientX, event.clientY);
              if (target == null) {
                // Clicked somewhere that can't accept the chunk (inside the
                // chunk itself): treat it as giving up on the move.
                abandonPlacementMode();
                return false;
              }
              placementTargetPos = target;
              performMove(editorView);
              return true;
            },
            keydown: (event, editorView) => {
              if (placementMode && event.key === "Escape") {
                abandonPlacementMode();
                return true;
              }
              if (handleHighlightShortcut(event)) {
                // Alt+digit otherwise inserts a character in some layouts.
                event.preventDefault();
                return true;
              }
              return handleEditingShortcut(event, editorView);
            },
          }),
          EditorView.updateListener.of((update) => {
            if (update.docChanged || update.selectionSet) updateActiveChunk();
            if (formatBar && !formatting) {
              if (update.docChanged) formatBar = null;
              else if (update.selectionSet && update.state.selection.main.empty) formatBar = null;
            }
            if (update.docChanged || update.geometryChanged) updateCopyDocPos();
            if (!update.docChanged) return;
            // A real edit while placement mode is armed reads as "the user moved
            // on" — the move's own transaction already clears placementMode
            // before dispatch, so this is a no-op for that one specific update.
            if (placementMode) cancelPlacementMode();
            scheduleSync();
            // `doc.length` is O(1) (unlike `.toString()`), safe to check every keystroke.
            const nowLarge = update.state.doc.length > LARGE_DOC_THRESHOLD;
            if (nowLarge !== isLargeDoc) {
              isLargeDoc = nowLarge;
              const size = update.state.doc.length;
              // Dispatching from inside an updateListener re-enters the view mid-update;
              // defer to a microtask so this transaction finishes first.
              queueMicrotask(() => {
                view?.dispatch({ effects: languageCompartment.reconfigure(languageExtensions(size)) });
              });
            }
          }),
          EditorView.theme({
            "&": {
              height: "100%",
              fontSize: "1.15rem",
              backgroundColor: "var(--color-bg)",
              color: "var(--color-text)",
            },
            ".cm-scroller": {
              fontFamily: "var(--font-prose)",
              fontWeight: "var(--font-prose-weight)",
              lineHeight: "1.75",
              padding: "0 var(--prose-gutter, 1rem)",
            },
            // The chapter header overlays the top of the scroller, so the
            // prose starts below it. Its measured height comes in as a custom
            // property; zero when there's no header.
            ".cm-content": {
              maxWidth: "66ch",
              margin: "0 auto",
              padding: "calc(4rem + var(--chapter-header-height, 0px)) 0 4rem",
              caretColor: "var(--color-accent)",
            },
            // CodeMirror defaults lines to `white-space: break-spaces` (for precise
            // trailing-space measurement); WebKitGTK appears to rasterize text under
            // that value noticeably heavier than `pre-wrap`. Prose doesn't need
            // break-spaces' exact trailing-whitespace behavior, so override it.
            ".cm-line": { whiteSpace: "pre-wrap" },
            "&.cm-focused": { outline: "none" },
            ".cm-selectionBackground, ::selection": { backgroundColor: "var(--color-selection) !important" },
            ".cm-placeholder": { color: "var(--color-text-muted)" },
          }),
          highlightThemeCompartment.of(highlightThemeFor(untrack(() => focusMode))),
        ],
      }),
    });

    // Content opened before the webfont finishes downloading paints with a fallback
    // font; CodeMirror's virtualized rendering won't re-measure on its own once the
    // real font swaps in, so force it once every requested weight has loaded.
    document.fonts.ready.then(() => view?.requestMeasure());

    drawMinimap();
    minimapResizeObserver = new ResizeObserver(() => {
      drawMinimap();
      updateChunkIconPos(); // the text column's right edge moves with the layout
      syncHeaderLayout(); // ...and so does the header aligned to that column
      updateCopyDocPos();
    });
    minimapResizeObserver.observe(container);
    // Scroll events fire far more often than the screen refreshes, so coalesce
    // them into at most one update per frame. Without this the work below runs
    // several times per rendered frame for no visible benefit.
    let scrollFrame = 0;
    function handleScroll() {
      // Outside the throttle below: that waits for an animation frame, and
      // frames stop when the window isn't drawing. Keeping the writer's place
      // shouldn't depend on the screen being painted, and this only resets a
      // timer, so it costs nothing to do on every scroll.
      onPlaceChange?.();

      if (scrollFrame) return;
      scrollFrame = requestAnimationFrame(() => {
        scrollFrame = 0;
        updateMinimapViewport();
        updateChunkIconPos();
        updateCopyDocPos();
        if (formatBar) showFormatBar();
      });
    }
    view.scrollDOM.addEventListener("scroll", handleScroll, { passive: true });
    scrollHandlerRef = handleScroll;
    updateActiveChunk();

    const startAt = untrack(() => initialPosition);
    if (startAt) {
      view.dispatch({ selection: { anchor: Math.min(startAt.cursor, view.state.doc.length) } });
      scrollToPlace(startAt);
    }
  });

  // Assigned inside onMount (needs the closure over the freshly-created view's
  // handler); referenced here purely so onDestroy can remove the same function.
  let scrollHandlerRef: (() => void) | undefined;

  onDestroy(() => {
    if (syncTimeout) clearTimeout(syncTimeout);
    cancelScheduledMinimapDraw();
    minimapResizeObserver?.disconnect();
    if (highlightsSyncTimeout) clearTimeout(highlightsSyncTimeout);
    if (scrollHandlerRef) view?.scrollDOM.removeEventListener("scroll", scrollHandlerRef);
    placementDismiss?.();
    view?.destroy();
  });

  // Keep the editor in sync when `value` is replaced from outside (e.g. opening a
  // file) — but not when `value` just changed because we ourselves emitted it via
  // scheduleSync/getValue, which is why this compares against `lastEmitted` instead
  // of re-deriving the doc string (that comparison alone was the second O(n) cost
  // stacking on every keystroke, on top of the one in scheduleSync).
  $effect(() => {
    if (view && value !== lastEmitted) {
      // A pending debounced sync belongs to whatever content was live before this
      // external replacement; letting it fire later would stomp the new content.
      if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = undefined;
      }
      isLargeDoc = value.length > LARGE_DOC_THRESHOLD;
      const restored = pendingHighlights ?? [];
      pendingHighlights = null;
      chunkHistoryMap = pendingChunkHistory ?? {};
      pendingChunkHistory = null;
      chunkNotes = pendingChunkNotes ?? {};
      pendingChunkNotes = null;
      const place = pendingPosition;
      pendingPosition = null;
      notePopover = null;
      // A different file's chunks are gone from view either way; close
      // anything referencing the old ones so nothing stale lingers.
      draftPanel = null;
      cancelPlacementMode();
      view.dispatch({
        changes: { from: 0, to: view.state.doc.length, insert: value },
        // Clamped: the file may have been edited elsewhere since, and a cursor
        // past the end would throw.
        selection: place ? { anchor: Math.min(place.cursor, value.length) } : undefined,
        effects: [
          // Highlight ranges are plain offsets with no notion of "which file" they
          // belong to — without this they'd silently reapply to whatever text now
          // occupies those same offsets in the newly-loaded document. Restoring
          // (if the caller set pendingHighlights) happens in this same transaction
          // so the document and its highlights are never out of sync for a tick.
          clearHighlights.of(null),
          languageCompartment.reconfigure(languageExtensions(value.length)),
          ...restored.map((h) => setHighlight.of({ from: h.from, to: h.to, stateId: h.stateId, id: h.id })),
        ],
      });
      // Clearing the pending sync above isn't enough: the dispatch just made
      // is itself a document change, so the update listener ran during it and
      // armed a fresh one. Left alone it fires ~200ms later and reports this
      // load back as an edit, which marks a freshly-opened file as unsaved.
      if (syncTimeout) {
        clearTimeout(syncTimeout);
        syncTimeout = undefined;
      }
      lastEmitted = value;
      if (place) scrollToPlace(place);
      drawMinimap();
      updateActiveChunk();
    }
  });

  // Re-reserve the prose's top padding whenever the header appears, disappears,
  // or changes size — expanding, collapsing, wrapping to another line, or the
  // reader dragging the textarea's resize handle.
  let headerResizeObserver: ResizeObserver | undefined;
  $effect(() => {
    const el = headerEl;
    showHeader;
    syncHeaderLayout();
    if (!el) return;
    headerResizeObserver = new ResizeObserver(() => syncHeaderLayout());
    headerResizeObserver.observe(el);
    return () => headerResizeObserver?.disconnect();
  });

  // Leaving focus mode recreates the canvas element from scratch, so it comes
  // back blank until something redraws it.
  $effect(() => {
    if (!focusMode && !plain) drawMinimap();
  });

  // Swap the highlight colours in/out as focus mode toggles. Reads focusMode
  // so it re-runs on change; the initial state is already set at construction.
  $effect(() => {
    const hidden = focusMode;
    if (!view) return;
    view.dispatch({ effects: highlightThemeCompartment.reconfigure(highlightThemeFor(hidden)) });
  });
</script>

<div class="editor" bind:this={container}>
  {#if showHeader}
    <div class="chapter-header" bind:this={headerEl}>
      <ChapterHeader
        bind:this={chapterHeaderRef}
        plan={chapter.plan}
        synopsis={chapter.text}
        onPlanChange={(beats: MariPlanBeat[]) => onChapterChange?.({ ...chapter, plan: beats })}
        onSynopsisChange={(text) => onChapterChange?.({ ...chapter, text })}
        drawerCount={cuts.length}
        onOpenDrawer={() => (drawerOpen = !drawerOpen)}
        onOpenField={() => (drawerOpen = false)}
      />
    </div>
  {/if}

  {#if drawerOpen && !plain}
    <div bind:this={drawerEl}>
      <DrawerPanel
        {cuts}
        onPutBack={putBackCut}
        onDelete={(cut) => onCutsChange?.(cuts.filter((c) => c.id !== cut.id))}
        onClose={() => (drawerOpen = false)}
      />
    </div>
  {/if}
</div>

{#if !focusMode && !plain}
  <canvas
    class="minimap"
    bind:this={minimapCanvas}
    style="left: {minimapBoxLeftPx}px; top: {minimapBoxTopPx}px;"
    onclick={handleMinimapClick}
  ></canvas>

  <div
    class="minimap-viewport"
    bind:this={minimapViewportEl}
    style="left: {minimapBoxLeftPx}px; top: {minimapBoxTopPx}px; width: {MINIMAP_WIDTH_PX}px;"
  ></div>
{/if}

{#if copyDocPos}
  <button
    class="copy-doc"
    style="left: {copyDocPos.left}px; top: {copyDocPos.top}px;"
    onclick={copyWholeDocument}
    title={copiedDocument ? "Copied" : "Copy the whole chapter"}
    aria-label="Copy the whole chapter"
  >
    <Icon name={copiedDocument ? "check" : "copy"} size={13} />
  </button>
{/if}

{#if formatBar && !focusMode && !placementMode && !draftPanel}
  <FormatBar
    x={formatBar.x}
    y={formatBar.y}
    active={formatActive}
    onInline={applyInline}
    onBlock={applyBlock}
  />
{/if}

{#if highlightMenu}
  <ContextMenu x={highlightMenu.x} y={highlightMenu.y} items={highlightMenuItems} onDismiss={() => (highlightMenu = null)} />
{/if}

{#if activeChunk && chunkIconPos && !draftPanel && !placementMode && !focusMode && !plain}
  <div
    class="chunk-actions"
    style="left: {chunkIconPos.left + 6}px; top: {chunkIconPos.top}px;"
    onmouseenter={cancelHoverClear}
    onmouseleave={scheduleHoverClear}
    role="toolbar"
    tabindex="-1"
    aria-label="Passage actions"
  >
    {#if activeChunkState}
      <span class="chunk-state">
        <span class="chunk-state-dot" style="background: {activeChunkState.solid}"></span>
        {activeChunkState.label}
      </span>
    {/if}
    {#if !activeChunkNameOnly}
      <button
        class="chunk-icon"
        onclick={handleChunkIconClick}
        title={activeChunk.action === "reposition"
          ? "Move this passage"
          : activeChunk.action === "terminal"
            ? "View version history"
            : "Draft a rewrite"}
      >
        <Icon
          name={activeChunk.action === "reposition" ? "move" : activeChunk.action === "terminal" ? "history" : "pencil"}
          size={13}
        />
      </button>
    {/if}
    <!-- Only on Cut: the highlight says the passage should go, this carries
         it out. The other highlights aren't about removing anything. -->
    {#if activeChunk.stateId === "cut"}
      <button
        class="chunk-icon"
        onclick={() => activeChunk && cutToPanel(activeChunk.from, activeChunk.to)}
        title="Move this passage to the drawer"
      >
        <Icon name="archive" size={13} />
      </button>
    {/if}
    <!-- Notes are offered on every state, including the decided ones — "keep,
         but check the timeline here" is as worth recording as a rewrite. -->
    <button
      class="chunk-icon"
      class:has-note={!!chunkNotes[activeChunk.id]}
      onclick={() => activeChunk && openNotePopover(activeChunk)}
      title={chunkNotes[activeChunk.id] ? `Note: ${chunkNotes[activeChunk.id]}` : "Add a note"}
    >
      <Icon name="note" size={13} />
    </button>
  </div>
{/if}

{#if notePopover}
  {@const remaining = CHUNK_NOTE_MAX_LENGTH - notePopover.draft.length}
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="note-popover"
    bind:this={notePopoverEl}
    style="left: {notePopover.left}px; top: {notePopover.top}px;"
    role="dialog"
    tabindex="-1"
    aria-label="Passage note"
    onmouseenter={cancelHoverClear}
    onmouseleave={scheduleHoverClear}
  >
    <!-- svelte-ignore a11y_autofocus -->
    <textarea
      autofocus
      maxlength={CHUNK_NOTE_MAX_LENGTH}
      placeholder="What needs doing here?"
      bind:value={notePopover.draft}
      onblur={commitNote}
      onkeydown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          commitNote();
        }
      }}
    ></textarea>
    <span class="note-count" class:low={remaining <= 20}>{remaining}</span>
  </div>
{/if}

{#if placementMode}
  <div class="placement-banner">
    <Icon name="move" size={14} />
    <span>Repositioning: "{placementMode.preview}{placementMode.text.length > 60 ? '…' : ''}" — click where it should go, or press Esc to cancel.</span>
  </div>
{/if}

{#if placementIndicatorPos}
  <div
    class="placement-indicator"
    style="left: {placementIndicatorPos.left}px; top: {placementIndicatorPos.top}px; width: {placementIndicatorPos.width}px;"
  ></div>
{/if}

{#if draftPanel}
  <DraftPanel
    originalText={draftPanel.originalText}
    history={chunkHistoryMap[draftPanel.chunk.id] ?? []}
    startMode={draftPanel.chunk.action === "terminal" ? "history" : "write"}
    onReplace={handleDraftReplace}
    onClose={() => (draftPanel = null)}
  />
{/if}

<style>
  .editor {
    position: relative;
    height: 100%;
  }

  /* Pinned to the document's top-left corner, left-aligned to the document
     rather than to the centred prose column. The prose scrolls underneath. */
  .chapter-header {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 3;
    pointer-events: none;
    padding: 1.5rem 0 0 var(--space-4);
  }

  .chapter-header > :global(*) {
    pointer-events: auto;
  }

  /* Anchors to the nearest positioned ancestor (.editor-wrap in +page.svelte). */
  .minimap {
    position: absolute;
    cursor: pointer;
    border-radius: 4px;
    background: var(--color-bg);
    box-shadow: 0 0 0 1px var(--color-border);
  }

  /* The "currently visible" indicator, VS Code style — sits on top of the
     minimap and tracks editor scroll. pointer-events: none so clicks (and
     the existing click-to-jump behavior) still reach the canvas underneath. */
  .minimap-viewport {
    position: absolute;
    pointer-events: none;
    background: rgba(128, 128, 128, 0.25);
    border: 1px solid rgba(128, 128, 128, 0.4);
    border-radius: 2px;
    box-sizing: border-box;
  }

  /* Anchored to the chunk's top-right corner (see updateChunkIconPos) via
     view.coordsAtPos/getBoundingClientRect, both viewport coordinates —
     fixed positioning matches that directly, same as ContextMenu's raw
     clientX/clientY. */
  /* The state name plus its actions, as one strip in the margin. */
  /* Sits past the last line, level with the right-hand edge of the prose. */
  .copy-doc {
    position: fixed;
    z-index: 4;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--color-text-muted);
    opacity: 0.55;
    cursor: pointer;
    transition: opacity 0.12s ease, color 0.12s ease;
  }

  .copy-doc:hover {
    opacity: 1;
    color: var(--color-text);
    background: var(--color-hover);
  }

  .chunk-actions {
    position: fixed;
    z-index: 140;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transform: translateY(-25%);
  }

  .chunk-state {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    height: 22px;
    padding: 0 8px;
    border: 1px solid var(--color-border);
    border-radius: 11px;
    background: var(--color-surface);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    color: var(--color-text-muted);
    font-size: 0.68rem;
    font-weight: 600;
    letter-spacing: 0.02em;
    white-space: nowrap;
  }

  .chunk-state-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  .chunk-icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    border: 1px solid var(--color-border);
    border-radius: 50%;
    background: var(--color-surface);
    color: var(--color-text-muted);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.12);
    cursor: pointer;
    flex-shrink: 0;
  }

  .chunk-icon:hover {
    color: var(--color-accent);
    border-color: var(--color-accent);
  }

  /* A chunk that already carries a note reads as filled rather than outline,
     so you can tell at a glance without opening it. */
  .chunk-icon.has-note {
    background: var(--color-action);
    border-color: var(--color-action);
    color: #fff;
  }

  .chunk-icon.has-note:hover {
    background: var(--color-action-hover);
    border-color: var(--color-action-hover);
    color: #fff;
  }

  .note-popover {
    position: fixed;
    z-index: 150;
    width: 260px;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    box-shadow: 0 10px 28px rgba(0, 0, 0, 0.16), 0 2px 8px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .note-popover textarea {
    width: 100%;
    min-height: 72px;
    resize: vertical;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-bg);
    color: var(--color-text);
    font-family: var(--font-ui);
    font-size: 0.82rem;
    line-height: 1.45;
    padding: 6px 8px;
  }

  .note-popover textarea:focus {
    outline: none;
    border-color: var(--color-action);
  }

  .note-count {
    align-self: flex-end;
    font-size: 0.7rem;
    color: var(--color-text-muted);
    font-variant-numeric: tabular-nums;
  }

  .note-count.low {
    color: var(--color-action);
  }

  .placement-banner {
    position: fixed;
    top: 12px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 160;
    display: flex;
    align-items: center;
    gap: 8px;
    max-width: min(560px, 80vw);
    padding: 8px 14px;
    border-radius: 20px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.15);
    color: var(--color-text);
    font-size: 0.82rem;
  }

  .placement-banner span {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .placement-indicator {
    position: fixed;
    height: 2px;
    background: var(--color-accent);
    z-index: 155;
    pointer-events: none;
    border-radius: 1px;
  }
</style>
