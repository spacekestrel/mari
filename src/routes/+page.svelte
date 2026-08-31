<script lang="ts">
  import { onMount } from "svelte";
  import ConfirmDialog from "$lib/components/ConfirmDialog.svelte";
  import ContextMenu from "$lib/components/ContextMenu.svelte";
  import Editor, { type HighlightRange } from "$lib/components/Editor.svelte";
  import FileMenu from "$lib/components/FileMenu.svelte";
  import Icon from "$lib/components/Icon.svelte";
  import MarkdownHelp from "$lib/components/MarkdownHelp.svelte";
  import Preview from "$lib/components/Preview.svelte";
  import Settings from "$lib/components/Settings.svelte";
  import Sidebar from "$lib/components/Sidebar.svelte";
  import Terminal from "$lib/components/Terminal.svelte";
  import TitleBar from "$lib/components/TitleBar.svelte";
  import { basename, getFileSystemAdapter, type FsEntry, type OpenedFile } from "$lib/platform";
  import { isLinuxDesktop, isTauriDesktop } from "$lib/platform/os";
  import { getLastSession, updateLastSession } from "$lib/platform/lastSession";
  import { countChars, countWords } from "$lib/wordcount";
  import { deletePreference } from "$lib/deletePreference.svelte";
  import { paragraphStyle } from "$lib/paragraphStyle.svelte";
  import { sidebarWidth } from "$lib/sidebarWidth.svelte";
  import { canDrop, pathAfterMove, isWithin } from "$lib/treeMove";
  import { expandedFolders } from "$lib/expandedFolders.svelte";
  import { enterFullscreen, exitFullscreen } from "$lib/platform/fullscreen";
  import type { ChunkVersion } from "$lib/chunkHistory";
  import {
    packMariBundle,
    unpackMariBundle,
    isMariFile,
    MARI_EXTENSION,
    MARI_FORMAT_VERSION,
    emptySynopsis,
    type MariManifest,
    type MariCut,
    type MariSynopsis,
  } from "$lib/mariBundle";
  import { docxToMarkdown, markdownToDocx, isDocxFile, DOCX_EXTENSION } from "$lib/docx";

  let file = $state<OpenedFile | null>(null);
  // $state because the editor is now conditionally rendered — this reference
  // comes and goes with it, and callers need to see that.
  let editorRef = $state<Editor | undefined>();
  let text = $state("");
  let dirty = $state(false);
  let distractionFree = $state(false);
  let statusMessage = $state("");

  let openedFolder = $state<FsEntry | null>(null);
  let sidebarVisible = $state(true);
  let sidebarRefreshKey = $state(0);
  let activePath = $state<string | null>(null);
  let previewMode = $state(false);
  let canUseTerminal = $state(false);
  let terminalMounted = $state(false);
  let terminalOpen = $state(false);
  let pendingDelete = $state<{ entry: FsEntry; parent: FsEntry } | null>(null);
  let treeContextMenu = $state<{ entry: FsEntry; parent: FsEntry; x: number; y: number } | null>(null);
  // Seeds a freshly-(re)constructed Editor instance's initial decorations — see
  // the comment on Editor's `initialHighlights` prop for why this exists.
  let currentHighlights = $state<HighlightRange[]>([]);
  // Seeds a freshly-(re)constructed Editor instance's chunk draft/version
  // history — same rationale as currentHighlights above.
  let currentChunkHistory = $state<Record<string, ChunkVersion[]>>({});
  // Seeds a freshly-(re)constructed Editor instance's per-chunk notes.
  let currentChunkNotes = $state<Record<string, string>>({});
  // Set while a `.mari` bundle is the open document. Carries the parts this
  // build doesn't recognise so saving preserves them rather than stripping
  // whatever a newer version wrote.
  let activeBundle = $state<{ manifest: MariManifest; unknownParts: Record<string, Uint8Array> } | null>(null);
  // What the open chapter is about. Lives in the bundle, so plain files have none.
  let currentSynopsis = $state<MariSynopsis>(emptySynopsis());
  /**
   * False until a document is actually opened or started. On a first run there
   * is nothing to edit yet, and showing a blank page that isn't a file — no
   * name, nowhere on disk — invites writing into something that can't be saved.
   */
  let documentOpen = $state(false);
  // Passages cut out of the prose but kept against the file.
  let currentCuts = $state<MariCut[]>([]);

  const runningInTauri = isTauriDesktop();

  // Focus mode goes real fullscreen — Tauri's setFullscreen on desktop, the
  // browser's own Fullscreen API on the web build (like pressing F11). Must be
  // called synchronously from the triggering click/keydown, not from a $effect —
  // the Fullscreen API only grants requests made within the original user
  // gesture's call stack, and effects run a tick after the DOM update.
  function setFocusMode(value: boolean) {
    distractionFree = value;
    if (value) {
      enterFullscreen();
    } else {
      exitFullscreen();
    }
  }

  onMount(async () => {
    canUseTerminal = await isLinuxDesktop();
    await restoreLastSession();
  });

  // If the browser's own UI is used to exit fullscreen (not our button/Escape),
  // keep distractionFree in sync rather than leaving stale hidden chrome.
  onMount(() => {
    function handleFullscreenChange() {
      if (!document.fullscreenElement && distractionFree) {
        distractionFree = false;
      }
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", handleFullscreenChange);
  });

  /**
   * Keeps unsaved work on the way out rather than asking about it. The window
   * closes either way — everything not yet saved is put by, and comes back
   * next launch exactly as it was.
   *
   * Registering this listener makes Tauri route every close through JS —
   * including the titlebar's X, which calls `close()` — and the wrapper then
   * calls `destroy()` itself when the event isn't prevented, which is why the
   * window needs `core:window:allow-destroy`.
   */
  onMount(() => {
    if (!runningInTauri) return;
    let unlisten: (() => void) | undefined;
    let disposed = false;

    import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
      const off = await getCurrentWindow().onCloseRequested(() => {
        // Synchronous on purpose: the window closes as soon as this returns.
        rememberPlace();
        if (hasUnsavedWork() && activePath && isMariFile(displayName)) {
          setAside.set(activePath, buildBundle());
        }
        persistSetAside();
      });
      if (disposed) off();
      else unlisten = off;
    });

    return () => {
      disposed = true;
      unlisten?.();
    };
  });

  /**
   * True if anything would be lost by closing now. `dirty` alone isn't enough:
   * the editor debounces its content sync, and a synopsis or plan still being
   * typed hasn't been handed over yet — so settle both before deciding.
   */
  function hasUnsavedWork(): boolean {
    editorRef?.flushChapterHeader();
    const latest = editorRef?.getValue();
    if (latest !== undefined && latest !== text) {
      text = latest;
      dirty = true;
    }
    // Chapters you moved away from without saving count too — they only exist
    // in memory, so closing would take them with it.
    return dirty || setAside.size > 0;
  }

  /**
   * Plain `.md` / `.txt` files carry no marks, notes or history — those live
   * inside `.mari` files. Opening one therefore clears whatever the previous
   * document had rather than loading anything.
   */
  function resetDocumentExtras() {
    activeBundle = null;
    currentHighlights = [];
    editorRef?.setPendingHighlights([]);
    currentChunkNotes = {};
    editorRef?.setPendingChunkNotes({});
    currentChunkHistory = {};
    editorRef?.setPendingChunkHistory({});
    currentSynopsis = emptySynopsis();
    currentCuts = [];
  }

  /**
   * Opens a file from the project tree. `.mari` entries are zips, so they're
   * read as bytes and unpacked; anything else is plain text.
   */
  async function openEntry(entry: FsEntry) {
    const adapter = await getFileSystemAdapter();
    if (isMariFile(entry.name)) {
      // Changes left behind last time you were here come back as they were,
      // still unsaved. Only if there are none is the file read from disk.
      const waiting = setAside.get(entry.path);
      const bytes = waiting ?? (await adapter.readBinaryFile(entry));
      // Both routes: the prop covers the first chapter after launch, when
      // there's no editor yet; the setter covers every switch after that.
      initialPlace = places.get(entry.path) ?? null;
      editorRef?.setPendingPosition(initialPlace);
      adoptBundle(unpackMariBundle(bytes), entry.name, entry.handle);
      activePath = entry.path;
      if (waiting) dirty = true;
      return;
    }
    // Word files are zips too, so they're read as bytes and converted to the
    // Markdown the editor works in. Saving converts back the same way.
    if (isDocxFile(entry.name)) {
      const bytes = await adapter.readBinaryFile(entry);
      const prose = docxToMarkdown(bytes);
      file = { name: entry.name, content: prose, handle: entry.handle };
      text = prose;
      documentOpen = true;
      dirty = false;
      activePath = entry.path;
      resetDocumentExtras();
      return;
    }
    const opened = await adapter.readFile(entry);
    file = opened;
    text = opened.content;
    documentOpen = true;
    dirty = false;
    activePath = entry.path;
    resetDocumentExtras();
  }

  // Marks, notes and history are written when the `.mari` bundle is saved, so
  // these only keep the in-memory copy that the bundle is built from.
  function handleChunkNoteChange(chunkId: string, note: string | null) {
    const next = { ...currentChunkNotes };
    if (note) next[chunkId] = note;
    else delete next[chunkId];
    currentChunkNotes = next;
    dirty = true;
  }

  function handleChunkHistoryChange(chunkId: string, version: ChunkVersion) {
    currentChunkHistory = {
      ...currentChunkHistory,
      [chunkId]: [...(currentChunkHistory[chunkId] ?? []), version],
    };
    dirty = true;
  }

  function handleHighlightsChange(highlights: HighlightRange[]) {
    currentHighlights = highlights;
    dirty = true;
  }

  async function restoreLastSession() {
    const adapter = await getFileSystemAdapter();
    if (adapter.kind !== "tauri") return; // browsers can't silently regain file access across restarts

    const last = getLastSession();
    if (!last) return;

    if (last.folderPath) {
      openedFolder = { name: basename(last.folderPath), path: last.folderPath, kind: "directory", handle: last.folderPath };
      sidebarVisible = true;
    }

    if (last.filePath) {
      try {
        const entry: FsEntry = { name: basename(last.filePath), path: last.filePath, kind: "file", handle: last.filePath };
        await openEntry(entry);
      } catch (error) {
        // Renamed, moved or deleted since last time. Starting empty is the
        // right outcome, but say so rather than looking like a lost document.
        console.warn("Couldn't reopen last file", error);
        flash(`Couldn't reopen ${basename(last.filePath)}`, 4000);
        updateLastSession({ filePath: undefined });
      }
    }
  }

  const displayName = $derived(file?.name ?? "Untitled.mari");
  const wordCount = $derived(countWords(text));
  const charCount = $derived(countChars(text));
  const showSidebar = $derived(openedFolder !== null && sidebarVisible && !distractionFree);

  /**
   * How far right the prose sits in focus mode.
   *
   * Focus mode drops the chapter list, so the text is suddenly centred in the
   * whole window rather than in the space beside the sidebar — and it visibly
   * jumps left by half the sidebar's width on the way in. Shifting it back by
   * exactly that much means entering focus mode takes the chrome away and
   * leaves the writing where it was.
   *
   * Zero when there was no sidebar to lose, because then nothing moved.
   */
  const focusNudge = $derived(
    distractionFree && openedFolder !== null && sidebarVisible
      ? Math.round(sidebarWidth.current / 2)
      : 0,
  );
  // Preview renders Markdown as formatted text. That's a Markdown editor's
  // feature, not a writing one — a `.mari` chapter is prose, so it doesn't
  // offer it even though its content is stored as Markdown.
  const canPreview = $derived(/\.(md|markdown)$/i.test(displayName));
  const baseName = $derived(displayName.replace(/\.(mari|md|markdown|txt)$/i, ""));
  const showPreview = $derived(previewMode && canPreview);

  let flashTimer: ReturnType<typeof setTimeout> | undefined;

  function flash(message: string, ms = 2000) {
    statusMessage = message;
    // Without clearing the old one, a second message inherits the first's
    // remaining time and can vanish almost immediately.
    clearTimeout(flashTimer);
    flashTimer = setTimeout(() => (statusMessage = ""), ms);
  }

  /**
   * Says what went wrong and why. Every filesystem call here can fail for
   * reasons only the OS knows — no permission, no disk, file held open — and
   * "Couldn't save" on its own leaves the writer with nowhere to go.
   */
  function reportFailure(what: string, error: unknown) {
    const raw = error instanceof Error ? error.message : String(error ?? "");
    // `String({})` gives "[object Object]", which tells the writer nothing —
    // better to show no reason than a fake one.
    const reason = raw.startsWith("[object ") ? "" : raw.trim();
    // The full thing goes to the console; the status bar gets one short line.
    console.error(what, error);
    const short = reason.length > 90 ? `${reason.slice(0, 89)}…` : reason;
    flash(short ? `${what} — ${short}` : what, 5000);
  }

  function onChange(next: string) {
    text = next;
    dirty = true;
  }

  /**
   * Leaving a chapter with unsaved changes neither asks nor saves: the changes
   * are set aside under that chapter's path and put back when you return to
   * it. Nothing reaches disk until you save. The only case that still has to
   * ask is a document that has never been saved, which has no path to set
   * anything aside under.
   */
  let discardPrompt = $state<{ action: string; answer: (ok: boolean) => void } | null>(null);

  /**
   * Unsaved chapters, as the bytes their file would have had. Written to the
   * app's own storage as well as held here, so closing the window — or losing
   * it to a crash — doesn't take them with it. They come back on next launch
   * exactly as they were, still unsaved, and the file on disk is never touched.
   */
  const SET_ASIDE_KEY = "mari-unsaved-chapters";
  const setAside = new Map<string, Uint8Array>(loadSetAside());

  function loadSetAside(): [string, Uint8Array][] {
    if (typeof localStorage === "undefined") return [];
    try {
      const stored = JSON.parse(localStorage.getItem(SET_ASIDE_KEY) ?? "{}");
      return Object.entries(stored as Record<string, string>).map(([path, encoded]) => [
        path,
        Uint8Array.from(atob(encoded), (c) => c.charCodeAt(0)),
      ]);
    } catch {
      // Deliberately silent: unreadable backups only mean chapters open from
      // their files instead, which is what would have happened anyway.
      return [];
    }
  }

  /**
   * Where you were in each chapter, so returning to one puts you back at the
   * paragraph you left rather than the top. Kept alongside the unsaved work
   * and for the same reason: coming back to a novel at line one is a small
   * daily tax.
   */
  const PLACES_KEY = "mari-places";
  const places = new Map<string, { cursor: number; top: number }>(loadPlaces());
  /** Handed to a freshly built editor, which has no other way to be told. */
  let initialPlace = $state<{ cursor: number; top: number } | null>(null);

  function loadPlaces(): [string, { cursor: number; top: number }][] {
    if (typeof localStorage === "undefined") return [];
    try {
      const stored = JSON.parse(localStorage.getItem(PLACES_KEY) ?? "{}");
      return Object.entries(stored as Record<string, { cursor: number; top: number }>);
    } catch {
      // Deliberately silent: the worst case is opening at the top.
      return [];
    }
  }

  /**
   * Kept as the writer moves rather than only on the way out: the app doesn't
   * always get a tidy shutdown — a crash, or being killed — and a reading
   * place that only survives a polite close isn't much use.
   */
  let rememberTimer: ReturnType<typeof setTimeout> | undefined;
  function rememberPlaceSoon() {
    clearTimeout(rememberTimer);
    rememberTimer = setTimeout(rememberPlace, 400);
  }

  /** Notes where the writer is now, before the document is swapped out. */
  function rememberPlace() {
    if (!activePath) return;
    const where = editorRef?.getViewPosition();
    if (!where) return;
    places.set(activePath, where);
    persistPlaces();
  }

  function persistPlaces() {
    try {
      localStorage.setItem(PLACES_KEY, JSON.stringify(Object.fromEntries(places)));
    } catch {
      // Not worth telling anyone about: it only means opening at the top.
    }
  }

  function persistSetAside() {
    if (typeof localStorage === "undefined") return;
    try {
      const stored: Record<string, string> = {};
      for (const [path, bytes] of setAside) {
        let binary = "";
        for (const byte of bytes) binary += String.fromCharCode(byte);
        stored[path] = btoa(binary);
      }
      localStorage.setItem(SET_ASIDE_KEY, JSON.stringify(stored));
    } catch (error) {
      // Out of room, most likely. The chapter is still held in memory for this
      // session; say so rather than let the writer assume it's safe.
      reportFailure("Couldn't keep unsaved changes for next time", error);
    }
  }

  async function confirmDiscardIfDirty(action: string): Promise<boolean> {
    rememberPlace();
    if (!dirty) return true;

    if (!activePath) {
      return new Promise((resolve) => {
        discardPrompt = { action, answer: resolve };
      });
    }

    if (isMariFile(displayName)) {
      setAside.set(activePath, buildBundle());
      persistSetAside();
    }
    return true;
  }

  function answerDiscard(ok: boolean) {
    // Cleared first: the waiting caller may open another prompt immediately.
    const pending = discardPrompt;
    discardPrompt = null;
    pending?.answer(ok);
  }

  async function handleNew() {
    if (!(await confirmDiscardIfDirty("start a new file"))) return;
    file = null;
    text = "";
    // Asked for outright, so there's a document even though it has no file yet.
    documentOpen = true;
    dirty = false;
    activePath = null;
    // Everything the old chapter carried goes with it. Listing these by hand
    // here is how cuts and the synopsis previously leaked into the new file.
    resetDocumentExtras();
    updateLastSession({ filePath: undefined });
  }

  /** Every format Mari can open, in the order a writer is likely to want them. */
  const OPENABLE = ["mari", "docx", "md", "markdown", "txt"];

  /**
   * Opens any file Mari understands. Everything is read as bytes and decided
   * by extension: `.mari` and `.docx` are zips, the rest is text. One picker
   * rather than one per format — the writer knows which file they want, not
   * which of Mari's internal shapes it happens to be.
   */
  async function handleOpen() {
    if (!(await confirmDiscardIfDirty("open another file"))) return;
    try {
      const adapter = await getFileSystemAdapter();
      const picked = await adapter.openBinary(OPENABLE);
      if (!picked) return;
      const path = typeof picked.handle === "string" ? picked.handle : null;

      if (isMariFile(picked.name)) {
        adoptBundle(unpackMariBundle(picked.data), picked.name, picked.handle);
      } else {
        const prose = isDocxFile(picked.name)
          ? docxToMarkdown(picked.data)
          : new TextDecoder().decode(picked.data);
        file = { name: picked.name, content: prose, handle: picked.handle };
        text = prose;
        documentOpen = true;
        dirty = false;
        resetDocumentExtras();
      }
      activePath = path;
      if (path) updateLastSession({ filePath: path });
    } catch (error) {
      reportFailure("Couldn't open file", error);
    }
  }

  async function handleOpenFolder() {
    try {
      const adapter = await getFileSystemAdapter();
      const folder = await adapter.openFolder();
      if (!folder) return;
      openedFolder = folder;
      sidebarVisible = true;
      updateLastSession({ folderPath: folder.path });
    } catch (error) {
      reportFailure("Couldn't open folder", error);
    }
  }

  async function loadChildren(entry: FsEntry): Promise<FsEntry[]> {
    const adapter = await getFileSystemAdapter();
    return adapter.readDir(entry);
  }

  async function handleSelectFile(entry: FsEntry) {
    if (!(await confirmDiscardIfDirty("open this file"))) return;
    try {
      await openEntry(entry);
      updateLastSession({ filePath: entry.path });
    } catch (error) {
      reportFailure("Couldn't open file", error);
    }
  }

  async function handleCreateFile(dir: FsEntry, rawName: string) {
    // New files are `.mari` unless an extension was typed explicitly.
    const name = /\.[^./\\]+$/.test(rawName) ? rawName : `${rawName}${MARI_EXTENSION}`;
    const adapter = await getFileSystemAdapter();
    let created: FsEntry;
    try {
      created = await adapter.createFile(dir, name);
      // A zero-byte file isn't a readable zip, so a new `.mari` gets an empty
      // but valid bundle written into it straight away — otherwise it would
      // fail to open the first time it was clicked.
      if (isMariFile(name)) {
        const empty = packMariBundle({ text: "", highlights: [], notes: {}, history: {} });
        await adapter.saveBinary({ name, content: "", handle: created.handle }, empty);
      } else if (isDocxFile(name)) {
        // Same reasoning: an empty `.docx` still has to be a valid Word file.
        await adapter.saveBinary({ name, content: "", handle: created.handle }, markdownToDocx(""));
      }
    } catch (error) {
      reportFailure("Couldn't create file", error);
      return;
    }
    sidebarRefreshKey++;

    if (!(await confirmDiscardIfDirty("open the new file"))) return;
    try {
      await openEntry(created);
      updateLastSession({ filePath: created.path });
    } catch (error) {
      reportFailure("Couldn't open file", error);
    }
  }

  /**
   * Moves a file or folder into another folder, dragged in the tree.
   *
   * The move itself is one call. The work is everything filed *by path*: the
   * open document, the unsaved chapters put by for later, the reading places,
   * and which folders were expanded. None of those follow a rename on their
   * own, and a missed one strands unsaved work under a name nothing points at.
   */
  async function handleMoveEntry(source: FsEntry, targetDir: FsEntry, sourceParent: FsEntry) {
    if (!canDrop(source, targetDir)) return;

    const adapter = await getFileSystemAdapter();
    const from = source.path;
    try {
      const moved = await adapter.moveEntry(source, targetDir, sourceParent);
      const to = moved.path;

      // Unsaved chapters and reading places are keyed by path; re-file them
      // before anything can look them up under the old name.
      remapPaths(setAside, from, to);
      persistSetAside();
      remapPaths(places, from, to);
      persistPlaces();
      expandedFolders.rename(from, to);

      // The open document keeps its identity: same text, same unsaved state,
      // just a different address on disk.
      if (activePath && isWithin(activePath, from)) {
        const next = pathAfterMove(activePath, from, to);
        activePath = next;
        if (file) file = { ...file, handle: next };
        updateLastSession({ filePath: next });
      }

      sidebarRefreshKey++;
      flash(`Moved to ${targetDir.name}`);
    } catch (error) {
      reportFailure(`Couldn't move ${source.name}`, error);
    }
  }

  /** Re-files every key under a moved path, in place. */
  function remapPaths<T>(store: Map<string, T>, from: string, to: string) {
    for (const key of [...store.keys()]) {
      if (!isWithin(key, from)) continue;
      const value = store.get(key)!;
      store.delete(key);
      store.set(pathAfterMove(key, from, to), value);
    }
  }

  async function handleCreateFolder(dir: FsEntry, name: string) {
    const adapter = await getFileSystemAdapter();
    try {
      await adapter.createFolder(dir, name);
      sidebarRefreshKey++;
    } catch (error) {
      reportFailure("Couldn't create folder", error);
    }
  }

  async function performDelete(entry: FsEntry, parent: FsEntry) {
    const adapter = await getFileSystemAdapter();
    try {
      await adapter.deleteEntry(entry, parent);
      sidebarRefreshKey++;
      if (entry.kind === "file" && activePath === entry.path) {
        file = null;
        text = "";
        dirty = false;
        activePath = null;
        currentHighlights = [];
        currentChunkHistory = {};
        currentChunkNotes = {};
        activeBundle = null;
        updateLastSession({ filePath: undefined });
      }
    } catch (error) {
      reportFailure("Couldn't delete", error);
    }
  }

  function handleDeleteEntry(entry: FsEntry, parent: FsEntry) {
    if (deletePreference.skipConfirm) {
      performDelete(entry, parent);
      return;
    }
    pendingDelete = { entry, parent };
  }

  function handleTreeContextMenu(entry: FsEntry, parent: FsEntry, x: number, y: number) {
    treeContextMenu = { entry, parent, x, y };
  }

  function confirmPendingDelete(dontAskAgain: boolean) {
    if (!pendingDelete) return;
    const { entry, parent } = pendingDelete;
    pendingDelete = null;
    if (dontAskAgain) deletePreference.set(true);
    performDelete(entry, parent);
  }

  /** Guards against a save triggering itself — see saveThrough. */
  let savingThrough = false;

  /**
   * Writes the file now rather than waiting for Ctrl+S. Everything in the
   * chapter header behaves this way: cutting a passage takes it out of the
   * prose, and a synopsis or plan is a decision, not a draft — none of it
   * should be sitting only in memory when the app closes.
   */
  async function saveThrough() {
    // A document that's never been saved has nowhere to write yet, and a Save
    // As dialog mid-thought would be worse than waiting for the next save.
    if (!file || !isMariFile(file.name)) return;

    // Saving flushes the header's open box, which reports the change, which
    // lands back here. The save already in flight will pick it up — it flushes
    // before it packs — so the nested call has nothing left to do.
    if (savingThrough) return;

    savingThrough = true;
    try {
      // handleSave reports its own failure and leaves the document dirty when
      // it fails — so a cut that didn't reach disk still shows as unsaved.
      await handleSave();
    } finally {
      savingThrough = false;
    }
  }

  async function persistCuts(next: MariCut[]) {
    currentCuts = next;
    dirty = true;
    await saveThrough();
  }

  async function persistChapter(next: MariSynopsis) {
    currentSynopsis = next;
    dirty = true;
    await saveThrough();
  }

  /** The current document packed as a `.mari` zip. */
  function buildBundle(): Uint8Array {
    // A synopsis or plan still being typed hasn't reached `currentSynopsis`
    // yet. Ctrl+S doesn't move focus, so without this the box's contents would
    // be dropped and the file written out without them.
    editorRef?.flushChapterHeader();
    return packMariBundle({
      text,
      highlights: editorRef?.flushHighlights() ?? currentHighlights,
      notes: currentChunkNotes,
      history: currentChunkHistory,
      synopsis: currentSynopsis,
      cuts: currentCuts,
      manifest: activeBundle?.manifest,
      unknownParts: activeBundle?.unknownParts,
    });
  }

  function adoptBundle(bundle: ReturnType<typeof unpackMariBundle>, name: string, handle: unknown) {
    file = { name, content: bundle.text, handle };
    text = bundle.text;
    activeBundle = { manifest: bundle.manifest, unknownParts: bundle.unknownParts };
    // A bundle carries its own metadata, so nothing is read from a sidecar.
    currentHighlights = bundle.highlights;
    editorRef?.setPendingHighlights(bundle.highlights);
    currentChunkNotes = bundle.notes;
    editorRef?.setPendingChunkNotes(bundle.notes);
    currentChunkHistory = bundle.history;
    editorRef?.setPendingChunkHistory(bundle.history);
    currentSynopsis = bundle.synopsis;
    currentCuts = bundle.cuts;
    documentOpen = true;
    dirty = false;
    activePath = typeof handle === "string" ? handle : null;
  }
  async function handleSaveAsMari(): Promise<boolean> {
    text = editorRef?.getValue() ?? text;
    try {
      const adapter = await getFileSystemAdapter();
      const saved = await adapter.saveBinaryAs(buildBundle(), `${baseName}${MARI_EXTENSION}`);
      if (!saved) return false; // dialog dismissed, not a failure
      activeBundle ??= { manifest: { format: "mari", version: MARI_FORMAT_VERSION }, unknownParts: {} };
      file = { ...saved, content: text };
      activePath = typeof saved.handle === "string" ? saved.handle : activePath;
      if (typeof saved.handle === "string") updateLastSession({ filePath: saved.handle });
      dirty = false;
      sidebarRefreshKey++;
      flash("Saved");
      return true;
    } catch (error) {
      reportFailure("Couldn't save", error);
      return false;
    }
  }

  /** True if the document reached disk. Reports its own failure either way. */
  async function handleSave(): Promise<boolean> {
    // Editor debounces its content sync for typing performance, so `text` can lag
    // behind by up to ~200ms — pull the true current content directly for saving.
    text = editorRef?.getValue() ?? text;

    // New documents are `.mari`, so an unsaved one goes straight to the bundle
    // path rather than being written out as plain text under a .mari name.
    if (!file) return handleSaveAsMari();

    try {
      const adapter = await getFileSystemAdapter();

      if (isMariFile(file.name)) {
        activeBundle ??= { manifest: { format: "mari", version: MARI_FORMAT_VERSION }, unknownParts: {} };
        await adapter.saveBinary(file, buildBundle());
        file = { ...file, content: text };
        if (activePath) {
          setAside.delete(activePath);
          persistSetAside();
        }
        dirty = false;
        flash("Saved");
        return true;
      }

      // A Word file saves back as Word. Like plain text it can only hold the
      // prose, so say so rather than letting the highlights quietly vanish.
      if (isDocxFile(file.name)) {
        const kept = editorRef?.flushHighlights() ?? [];
        await adapter.saveBinary(file, markdownToDocx(text));
        file = { ...file, content: text };
        dirty = false;
        flash(kept.length > 0 ? "Saved — highlights need a .mari file" : "Saved");
        return true;
      }

      // Plain text file: the prose is saved, the extras aren't — say so rather
      // than letting marks quietly vanish when the document is reopened.
      const marks = editorRef?.flushHighlights() ?? [];
      await adapter.save(file, text);
      file = { ...file, content: text };
      dirty = false;
      flash(marks.length > 0 ? "Saved — marks need a .mari file" : "Saved");
      return true;
    } catch (error) {
      // The document stays dirty, so the unsaved dot remains and the close
      // guard still fires. Nothing here pretends the write happened.
      reportFailure("Couldn't save", error);
      return false;
    }
  }

  /** Plain-text export; the marks and notes stay behind. */
  /**
   * Writes a copy in whichever format was chosen in the dialog. The open
   * document is left alone — this is a copy going somewhere, not a move.
   *
   * Only `.mari` carries the highlights, notes, plan and drawer, so exporting
   * to anything else says what stayed behind rather than losing it quietly.
   */
  async function handleSaveAs() {
    text = editorRef?.getValue() ?? text;
    try {
      const adapter = await getFileSystemAdapter();
      const target = await adapter.chooseSaveTarget(OPENABLE, `${baseName}${MARI_EXTENSION}`);
      if (!target) return; // dialog dismissed, not a failure

      let data: Uint8Array;
      if (isMariFile(target.name)) {
        data = buildBundle();
      } else if (isDocxFile(target.name)) {
        data = markdownToDocx(text);
      } else {
        data = new TextEncoder().encode(text);
      }

      await adapter.saveBinary({ name: target.name, content: text, handle: target.handle }, data);
      const kept = isMariFile(target.name) || (editorRef?.flushHighlights() ?? []).length === 0;
      flash(kept ? "Exported" : "Exported — highlights stay in the .mari");
      sidebarRefreshKey++;
    } catch (error) {
      reportFailure("Couldn't export", error);
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === "Escape" && distractionFree) {
      setFocusMode(false);
      return;
    }

    // F11 is what fullscreen is everywhere else, so it toggles focus mode
    // both ways. Prevented because the webview would otherwise take the key
    // and go fullscreen on its own, leaving the toolbar showing.
    if (e.code === "F11" && !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey) {
      e.preventDefault();
      setFocusMode(!distractionFree);
      return;
    }

    const mod = e.ctrlKey || e.metaKey;
    if (!mod) return;

    // Matched on the physical key rather than the character it produces. A
    // non-Latin layout reports Ctrl+S as "ы", and even on a Latin one holding
    // Shift reports "S" rather than "s" — so Ctrl+Shift+S and Ctrl+Shift+O
    // matched nothing at all. `code` names the key by where it sits.
    switch (e.code) {
      case "KeyS":
        e.preventDefault();
        if (e.shiftKey) handleSaveAs();
        else handleSave();
        break;
      case "KeyO":
        e.preventDefault();
        if (e.shiftKey) handleOpenFolder();
        else handleOpen();
        break;
      case "KeyN":
        e.preventDefault();
        handleNew();
        break;
      case "KeyV":
        // Only the Shift version is ours; plain Ctrl+V must stay paste.
        if (!e.shiftKey || !canPreview) break;
        e.preventDefault();
        previewMode = !previewMode;
        break;
    }
  }
</script>

<svelte:window onkeydown={onKeydown} />

<div class="shell">
  {#if runningInTauri && !distractionFree}
    <TitleBar
      onNew={handleNew}
      onOpenFile={handleOpen}
      onOpenFolder={handleOpenFolder}
      onSave={handleSave}
      onExportAs={handleSaveAs}
      {canUseTerminal}
      onToggleTerminal={() => {
        terminalMounted = true;
        terminalOpen = !terminalOpen;
      }}
    />
  {/if}
  <div
    class="app"
    class:distraction-free={distractionFree}
    style="--focus-nudge: {focusNudge}px"
  >
  <header class="toolbar">
    <div class="toolbar-group">
      {#if !runningInTauri}
        <FileMenu
          onNew={handleNew}
          onOpenFile={handleOpen}
          onOpenFolder={handleOpenFolder}
          onSave={handleSave}
          onExportAs={handleSaveAs}
                  {canUseTerminal}
          onToggleTerminal={() => {
            terminalMounted = true;
            terminalOpen = !terminalOpen;
          }}
        />
      {/if}
      {#if openedFolder}
        <button
          class="icon-btn"
          onclick={() => (sidebarVisible = !sidebarVisible)}
          title="Toggle sidebar"
          aria-label="Toggle sidebar"
        >
          <Icon name="sidebar" />
        </button>
      {/if}
    </div>

    <div class="filename">
      {#if documentOpen}
        <span class="dot" class:visible={dirty}></span>
        {displayName}
      {/if}
    </div>

    <div class="toolbar-group">
      <span class="status">{statusMessage}</span>
      {#if documentOpen}
        <button
          class="icon-btn"
          class:active={paragraphStyle.current === "book"}
          onclick={() => paragraphStyle.toggle()}
          title={paragraphStyle.current === "book"
            ? "Book layout: indented, no gaps. Click for spaced paragraphs."
            : "Spaced paragraphs. Click for book layout."}
          aria-label="Paragraph layout"
          aria-pressed={paragraphStyle.current === "book"}
        >
          <Icon name={paragraphStyle.current === "book" ? "paragraph-book" : "paragraph-spaced"} />
        </button>
      {/if}
      {#if canPreview}
        <button
          class="icon-btn"
          onclick={() => (previewMode = !previewMode)}
          title={previewMode ? "Edit (Ctrl+Shift+V)" : "Preview (Ctrl+Shift+V)"}
          aria-label="Toggle preview"
        >
          <Icon name={previewMode ? "pencil" : "article"} />
        </button>
        <MarkdownHelp />
      {/if}
      <Settings />
    </div>
  </header>

  <div class="body">
    {#if showSidebar && openedFolder}
      <Sidebar
        folder={openedFolder}
        {activePath}
        {loadChildren}
        onSelectFile={handleSelectFile}
        onCreateFile={handleCreateFile}
        onCreateFolder={handleCreateFolder}
        onContextMenu={handleTreeContextMenu}
        onMove={handleMoveEntry}
        refreshKey={sidebarRefreshKey}
      />
    {/if}
    <main class="editor-wrap">
      {#if !documentOpen}
        <div class="nothing-open">
          <p>Nothing open</p>
          <p class="hint">Open a folder or a file to start.</p>
        </div>
      {:else}
      <div class="pane" class:hidden={showPreview}>
        <Editor
          value={text}
          {onChange}
          onHighlightsChange={handleHighlightsChange}
          initialHighlights={currentHighlights}
          initialChunkHistory={currentChunkHistory}
          onChunkHistoryChange={handleChunkHistoryChange}
          initialChunkNotes={currentChunkNotes}
          onChunkNoteChange={handleChunkNoteChange}
          focusMode={distractionFree}
          plain={!isMariFile(displayName)}
          initialPosition={initialPlace}
          onPlaceChange={rememberPlaceSoon}
          cuts={currentCuts}
          onCutsChange={persistCuts}
          chapter={currentSynopsis}
          onChapterChange={persistChapter}
          bind:this={editorRef}
        />
      </div>
      {#if canPreview}
        <div class="pane" class:hidden={!showPreview}>
          <Preview {text} />
        </div>
      {/if}
      {/if}
      <button
        class="focus-fab"
        onclick={() => setFocusMode(!distractionFree)}
        title={distractionFree ? "Show toolbar (Esc)" : "Focus mode"}
        aria-label="Toggle focus mode"
      >
        <Icon name={distractionFree ? "minimize" : "maximize"} />
      </button>
    </main>
  </div>

  {#if terminalMounted}
    <div class="terminal-wrap" class:hidden={!terminalOpen}>
      <Terminal onClose={() => (terminalOpen = false)} cwd={openedFolder?.path} visible={terminalOpen} />
    </div>
  {/if}

  <footer class="status-bar">
    {#if documentOpen}
      <span>{wordCount} words</span>
      <span>{charCount} characters</span>
    {/if}
  </footer>
  </div>

  {#if discardPrompt}
    <ConfirmDialog
      title="Discard unsaved changes?"
      message={`Your changes to ${displayName} haven't been saved. Save first if you want to keep them.`}
      confirmLabel="Discard"
      showDontAskAgain={false}
      onConfirm={() => answerDiscard(true)}
      onCancel={() => answerDiscard(false)}
    />
  {/if}

  {#if pendingDelete}
    <ConfirmDialog
      title={`Delete ${pendingDelete.entry.name}?`}
      message={pendingDelete.entry.kind === "directory"
        ? "This deletes the folder and everything inside it. This can't be undone."
        : "This can't be undone."}
      onConfirm={confirmPendingDelete}
      onCancel={() => (pendingDelete = null)}
    />
  {/if}

  {#if treeContextMenu}
    <ContextMenu
      x={treeContextMenu.x}
      y={treeContextMenu.y}
      items={[
        {
          label: "Delete",
          icon: "trash",
          danger: true,
          onClick: () => handleDeleteEntry(treeContextMenu!.entry, treeContextMenu!.parent),
        },
      ]}
      onDismiss={() => (treeContextMenu = null)}
    />
  {/if}
</div>

<style>
  .shell {
    display: flex;
    flex-direction: column;
    height: 100vh;
  }

  .app {
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  }

  .toolbar {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
    align-items: center;
    padding: var(--space-2) var(--space-4);
    border-bottom: 1px solid var(--color-border);
    background: var(--color-surface);
    gap: var(--space-4);
    flex-shrink: 0;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .toolbar-group {
    display: flex;
    align-items: center;
    gap: var(--space-1);
  }

  .toolbar-group:last-child {
    justify-self: end;
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

  .icon-btn:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .filename {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    color: var(--color-text-muted);
    font-size: 0.8rem;
    letter-spacing: 0.01em;
    white-space: nowrap;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--color-accent);
    opacity: 0;
    transition: opacity 0.15s ease;
  }

  .dot.visible {
    opacity: 1;
  }

  .status {
    font-size: 0.75rem;
    color: var(--color-text-muted);
    min-width: 2.5rem;
    text-align: right;
  }

  .body {
    flex: 1;
    min-height: 0;
    display: flex;
  }

  .editor-wrap {
    position: relative;
    flex: 1;
    min-width: 0;
    height: 100%;
  }

  .pane {
    height: 100%;
  }

  .pane.hidden {
    display: none;
  }

  .focus-fab {
    position: absolute;
    bottom: 20px;
    right: 20px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    padding: 0;
    border: 1px solid var(--color-border);
    background: var(--color-surface);
    border-radius: 50%;
    color: var(--color-text-muted);
    cursor: pointer;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    transition: background-color 0.12s ease, color 0.12s ease;
    z-index: 10;
  }

  .focus-fab:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .nothing-open {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 6px;
    height: 100%;
    color: var(--color-text-muted);
    font-size: 0.9rem;
    user-select: none;
  }

  .nothing-open p {
    margin: 0;
  }

  .nothing-open .hint {
    font-size: 0.82rem;
    opacity: 0.75;
  }

  .status-bar {
    display: flex;
    gap: var(--space-4);
    justify-content: flex-end;
    padding: var(--space-2) var(--space-4);
    font-size: 0.75rem;
    color: var(--color-text-muted);
    border-top: 1px solid var(--color-border);
    background: var(--color-surface);
    flex-shrink: 0;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  .terminal-wrap.hidden {
    display: none;
  }

  /* Focus mode is meant to read like the browser's own F11: real fullscreen,
     nothing on screen but the prose. The focus button goes too — Esc is the
     way back out, same as F11 fullscreen anywhere else. */
  /* Padding rather than a transform: CodeMirror works out where a click
     landed from real layout, and moving the content with a transform would
     put the cursor somewhere other than where the pointer was.

     Twice the nudge, because the prose is centred in whatever room is left:
     adding 2n on the left moves the middle by n. */
  .distraction-free :global(.cm-scroller) {
    padding-left: calc(var(--prose-gutter, 1rem) + var(--focus-nudge, 0px) * 2);
  }

  .distraction-free .toolbar,
  .distraction-free .status-bar,
  .distraction-free .terminal-wrap,
  .distraction-free .focus-fab {
    display: none;
  }
</style>
