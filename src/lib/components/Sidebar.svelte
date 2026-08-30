<script lang="ts">
  import { untrack } from "svelte";
  import ContextMenu, { type ContextMenuItem } from "./ContextMenu.svelte";
  import Icon from "./Icon.svelte";
  import InlineNameInput from "./InlineNameInput.svelte";
  import TreeItem from "./TreeItem.svelte";
  import type { FsEntry } from "$lib/platform";
  import { sidebarWidth } from "$lib/sidebarWidth.svelte";
  import { canDrop } from "$lib/treeMove";

  interface Props {
    folder: FsEntry;
    activePath: string | null;
    loadChildren: (entry: FsEntry) => Promise<FsEntry[]>;
    onSelectFile: (entry: FsEntry) => void;
    onCreateFile: (dir: FsEntry, name: string) => void;
    onCreateFolder: (dir: FsEntry, name: string) => void;
    onContextMenu: (entry: FsEntry, parent: FsEntry, x: number, y: number) => void;
    onMove: (source: FsEntry, targetDir: FsEntry, sourceParent: FsEntry) => void;
    refreshKey: number;
  }

  let {
    folder,
    activePath,
    loadChildren,
    onSelectFile,
    onCreateFile,
    onCreateFolder,
    onContextMenu,
    onMove,
    refreshKey,
  }: Props = $props();

  let rootChildren = $state<FsEntry[] | null>(null);
  let loading = $state(false);
  let error = $state(false);
  let creatingRoot = $state<"file" | "folder" | null>(null);

  /** The folder currently on screen, so a reload can be told from a switch. */
  let shownFolderPath = $state<string | null>(null);

  $effect(() => {
    const opened = folder;
    refreshKey;

    // Switching to a different project replaces the list outright. Reloading
    // the same one must not: emptying it destroys every row, and each row is
    // what remembers whether its folder is open. That's what collapsed the
    // whole tree every time a file was created in it.
    const sameFolder = untrack(() => shownFolderPath) === opened.path;
    if (!sameFolder) rootChildren = null;

    // Only show the spinner when there's nothing to look at yet; a reload
    // shouldn't blank out a tree the writer is working in.
    loading = untrack(() => rootChildren) === null;
    error = false;

    loadChildren(opened)
      .then((entries) => {
        if (opened === folder) {
          rootChildren = entries;
          shownFolderPath = opened.path;
          loading = false;
        }
      })
      .catch(() => {
        if (opened === folder) {
          error = true;
          loading = false;
        }
      });
  });

  function confirmCreateRoot(name: string) {
    const kind = creatingRoot;
    creatingRoot = null;
    if (kind === "file") onCreateFile(folder, name);
    else if (kind === "folder") onCreateFolder(folder, name);
  }

  // Right-clicking empty sidebar space offers the same two create actions as
  // the header buttons. Right-clicking a tree item is handled by TreeItem
  // itself, which stops propagation so this never fires for those.
  let rootMenu = $state<{ x: number; y: number } | null>(null);

  /**
   * What is being dragged, held once for the whole tree.
   *
   * A drag's own dataTransfer can only carry strings, and a path string can't
   * be turned back into an entry with its handle. Keeping the entry itself
   * here means each row can judge whether it would accept the drop.
   */
  let dragging = $state<{ entry: FsEntry; parent: FsEntry } | null>(null);
  let rootDragOver = $state(false);

  // The empty space below the tree drops into the project root, which is the
  // only way to get something back out of a folder.
  const rootAccepts = $derived(!!dragging && canDrop(dragging.entry, folder));

  function handleRootDragOver(e: DragEvent) {
    if (!rootAccepts) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    rootDragOver = true;
  }

  function handleRootDrop(e: DragEvent) {
    if (!rootAccepts || !dragging) return;
    e.preventDefault();
    rootDragOver = false;
    onMove(dragging.entry, folder, dragging.parent);
  }

  const rootMenuItems: ContextMenuItem[] = [
    { label: "New file", icon: "file-plus", onClick: () => (creatingRoot = "file") },
    { label: "New folder", icon: "folder-plus", onClick: () => (creatingRoot = "folder") },
  ];

  // Drag-to-resize. Listeners go on window rather than the handle so the drag
  // survives the pointer outrunning a 6px strip, which it always does.
  let resizing = $state(false);

  function startResize(event: MouseEvent) {
    event.preventDefault();
    resizing = true;
    const startX = event.clientX;
    const startWidth = sidebarWidth.current;

    const onMove = (e: MouseEvent) => sidebarWidth.set(startWidth + (e.clientX - startX));
    const onUp = () => {
      resizing = false;
      sidebarWidth.persist();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  /** Double-click snaps back to the default width. */
  function resetWidth() {
    sidebarWidth.set(240);
    sidebarWidth.persist();
  }

  function handleRootContextMenu(e: MouseEvent) {
    e.preventDefault();
    // preventDefault only suppresses the native menu, not propagation — and
    // ContextMenu listens on window for contextmenu-to-dismiss, so without
    // this it would catch this same event and close itself instantly.
    e.stopPropagation();
    rootMenu = { x: e.clientX, y: e.clientY };
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
<nav class="sidebar" style="width: {sidebarWidth.current}px;" oncontextmenu={handleRootContextMenu}>
  <div class="sidebar-header">
    <span class="sidebar-title">{folder.name}</span>
    <div class="sidebar-actions">
      <button class="header-btn" onclick={() => (creatingRoot = "file")} title="New file" aria-label="New file">
        <Icon name="file-plus" size={14} />
      </button>
      <button class="header-btn" onclick={() => (creatingRoot = "folder")} title="New folder" aria-label="New folder">
        <Icon name="folder-plus" size={14} />
      </button>
    </div>
  </div>
  <div
    class="tree"
    class:root-drop={rootDragOver && rootAccepts}
    ondragover={handleRootDragOver}
    ondragleave={() => (rootDragOver = false)}
    ondrop={handleRootDrop}
    role="tree"
    tabindex="-1"
  >
    {#if creatingRoot}
      <InlineNameInput
        depth={0}
        placeholder={creatingRoot === "file" ? "chapter.mari" : "folder name"}
        onConfirm={confirmCreateRoot}
        onCancel={() => (creatingRoot = null)}
      />
    {/if}
    {#if loading}
      <div class="loading">Loading&hellip;</div>
    {:else if error}
      <div class="loading">Couldn't open this folder</div>
    {:else if rootChildren && rootChildren.length === 0 && !creatingRoot}
      <div class="loading">Empty folder</div>
    {:else if rootChildren}
      {#each rootChildren as entry (entry.path)}
        <TreeItem
          {entry}
          parent={folder}
          depth={0}
          {activePath}
          {loadChildren}
          {onSelectFile}
          {onCreateFile}
          {onCreateFolder}
          {onContextMenu}
          {onMove}
          {dragging}
          onDragStateChange={(e) => (dragging = e)}
          {refreshKey}
        />
      {/each}
    {/if}
  </div>
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <div
    class="resize-handle"
    class:active={resizing}
    onmousedown={startResize}
    ondblclick={resetWidth}
    role="separator"
    aria-orientation="vertical"
    aria-label="Resize sidebar"
    title="Drag to resize — double-click to reset"
  ></div>
</nav>

{#if rootMenu}
  <ContextMenu x={rootMenu.x} y={rootMenu.y} items={rootMenuItems} onDismiss={() => (rootMenu = null)} />
{/if}

<style>
  .sidebar {
    /* Width comes from the inline style so it can be dragged; the min/max
       here mirror the clamp in the store as a second line of defence. */
    position: relative;
    min-width: 160px;
    max-width: 520px;
    flex-shrink: 0;
    border-right: 1px solid var(--color-border);
    background: var(--color-surface);
    overflow-y: auto;
    padding: var(--space-2) 0;
    transition: background-color 0.15s ease, border-color 0.15s ease;
  }

  /* Sits over the border on the sidebar's right edge. Wider than it looks so
     it's actually grabbable, but visually it's just the existing 1px line. */
  .resize-handle {
    position: absolute;
    top: 0;
    right: -3px;
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

  .sidebar-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-1) var(--space-2) var(--space-1) var(--space-3);
  }

  .sidebar-title {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--color-text-muted);
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .sidebar-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .header-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 22px;
    height: 22px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 4px;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .header-btn:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .loading {
    padding: var(--space-1) var(--space-3);
    font-size: 0.8rem;
    color: var(--color-text-muted);
    font-style: italic;
  }
</style>
