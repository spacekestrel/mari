<script lang="ts">
  import Icon from "./Icon.svelte";
  import InlineNameInput from "./InlineNameInput.svelte";
  import Self from "./TreeItem.svelte";
  import type { FsEntry } from "$lib/platform";
  import { expandedFolders } from "$lib/expandedFolders.svelte";
  import { canDrop } from "$lib/treeMove";

  interface Props {
    entry: FsEntry;
    parent: FsEntry;
    depth: number;
    activePath: string | null;
    loadChildren: (entry: FsEntry) => Promise<FsEntry[]>;
    onSelectFile: (entry: FsEntry) => void;
    onCreateFile: (dir: FsEntry, name: string) => void;
    onCreateFolder: (dir: FsEntry, name: string) => void;
    onContextMenu: (entry: FsEntry, parent: FsEntry, x: number, y: number) => void;
    onMove: (source: FsEntry, targetDir: FsEntry, sourceParent: FsEntry) => void;
    /** The row being dragged right now, so every row can judge its own drop. */
    dragging: { entry: FsEntry; parent: FsEntry } | null;
    onDragStateChange: (dragged: { entry: FsEntry; parent: FsEntry } | null) => void;
    refreshKey: number;
  }

  let {
    entry,
    parent,
    depth,
    activePath,
    loadChildren,
    onSelectFile,
    onCreateFile,
    onCreateFolder,
    onContextMenu,
    onMove,
    dragging,
    onDragStateChange,
    refreshKey,
  }: Props = $props();

  // Remembered across restarts rather than held here: a row only exists while
  // it's on screen, so it can't remember whether it was open.
  const expanded = $derived(expandedFolders.isExpanded(entry.path));
  let children = $state<FsEntry[] | null>(null);
  let loading = $state(false);
  let hovering = $state(false);
  let creating = $state<"file" | "folder" | null>(null);

  function handleActivate() {
    if (entry.kind === "file") {
      onSelectFile(entry);
      return;
    }
    expandedFolders.toggle(entry.path);
  }

  function startCreate(kind: "file" | "folder", e: MouseEvent) {
    e.stopPropagation();
    expandedFolders.set(entry.path, true);
    creating = kind;
  }

  function confirmCreate(name: string) {
    const kind = creating;
    creating = null;
    if (kind === "file") onCreateFile(entry, name);
    else if (kind === "folder") onCreateFolder(entry, name);
  }

  // True while something is being dragged that this row would accept.
  const isDropTarget = $derived(!!dragging && canDrop(dragging.entry, entry));
  let dragOver = $state(false);

  // Expanding on hover, the way a file manager does: dropping into a closed
  // folder otherwise means letting go, opening it, and dragging again.
  let hoverExpand: ReturnType<typeof setTimeout> | null = null;

  function handleDragOver(e: DragEvent) {
    if (!isDropTarget) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (dragOver) return;
    dragOver = true;
    if (!expanded) {
      hoverExpand = setTimeout(() => expandedFolders.set(entry.path, true), 600);
    }
  }

  function clearDragOver() {
    dragOver = false;
    if (hoverExpand) {
      clearTimeout(hoverExpand);
      hoverExpand = null;
    }
  }

  function handleDrop(e: DragEvent) {
    if (!isDropTarget || !dragging) return;
    e.preventDefault();
    // Otherwise every folder up the tree handles the same drop.
    e.stopPropagation();
    clearDragOver();
    onMove(dragging.entry, entry, dragging.parent);
  }

  function handleContextMenu(e: MouseEvent) {
    e.preventDefault();
    // Without this, the event keeps bubbling to window after preventDefault()
    // (that only suppresses the native menu, not propagation) — and since the
    // menu we're about to open listens on window for contextmenu-to-dismiss,
    // it would catch this same event and close itself instantly.
    e.stopPropagation();
    onContextMenu(entry, parent, e.clientX, e.clientY);
  }

  // Re-fetches whenever expanded (so newly-saved files show up), and drops the
  // cache on collapse so the next expand is always fresh rather than stale.
  $effect(() => {
    refreshKey;
    if (!expanded) {
      children = null;
      return;
    }
    loading = true;
    loadChildren(entry).then((result) => {
      children = result;
      loading = false;
    });
  });
</script>

<div
  class="row"
  class:active={entry.kind === "file" && entry.path === activePath}
  class:drop-target={dragOver && isDropTarget}
  class:being-dragged={dragging?.entry.path === entry.path}
  style="padding-left: {depth * 14 + 8}px"
  draggable="true"
  ondragstart={(e) => {
    e.stopPropagation();
    // Some payload is required or the drag never starts; the row itself is
    // tracked in state, since a path string can't carry the entry's handle.
    e.dataTransfer?.setData("text/plain", entry.path);
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    onDragStateChange({ entry, parent });
  }}
  ondragend={() => {
    clearDragOver();
    onDragStateChange(null);
  }}
  ondragover={handleDragOver}
  ondragleave={clearDragOver}
  ondrop={handleDrop}
  onclick={handleActivate}
  onkeydown={(e) => e.key === "Enter" && handleActivate()}
  onmouseenter={() => (hovering = true)}
  onmouseleave={() => (hovering = false)}
  oncontextmenu={handleContextMenu}
  role="button"
  tabindex="0"
>
  {#if entry.kind === "directory"}
    <span class="chevron" class:expanded><Icon name="chevron-right" size={13} /></span>
  {:else}
    <span class="chevron-spacer"></span>
  {/if}
  <Icon name={entry.kind === "directory" ? "folder" : "file"} size={13} />
  <span class="name">{entry.name}</span>
  {#if hovering && entry.kind === "directory"}
    <span class="row-actions">
      <button class="row-btn" onclick={(e) => startCreate("file", e)} title="New file" aria-label="New file">
        <Icon name="file-plus" size={12} />
      </button>
      <button class="row-btn" onclick={(e) => startCreate("folder", e)} title="New folder" aria-label="New folder">
        <Icon name="folder-plus" size={12} />
      </button>
    </span>
  {/if}
</div>

{#if entry.kind === "directory" && expanded}
  {#if creating}
    <InlineNameInput
      depth={depth + 1}
      placeholder={creating === "file" ? "chapter.mari" : "folder name"}
      onConfirm={confirmCreate}
      onCancel={() => (creating = null)}
    />
  {/if}
  <!-- What's already here wins over the spinner. Showing "Loading…" instead
       of the current rows destroys them, and each row is what remembers
       whether its own folder is open — so a refresh collapsed everything
       below this one. -->
  {#if children}
    {#each children as child (child.path)}
      <Self
        entry={child}
        parent={entry}
        depth={depth + 1}
        {activePath}
        {onMove}
        {dragging}
        {onDragStateChange}
        {loadChildren}
        {onSelectFile}
        {onCreateFile}
        {onCreateFolder}
        {onContextMenu}
        {refreshKey}
      />
    {/each}
  {:else if loading}
    <div class="loading" style="padding-left: {(depth + 1) * 14 + 8}px">Loading&hellip;</div>
  {/if}
{/if}

<style>
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    padding-top: 4px;
    padding-bottom: 4px;
    padding-right: var(--space-2);
    font-size: 0.82rem;
    color: var(--color-text-muted);
    cursor: pointer;
    user-select: none;
    white-space: nowrap;
  }

  /* A clear line where it will land, rather than a vague tint: the difference
     between "inside this folder" and "somewhere near it" matters. */
  .row.drop-target {
    background: var(--color-hover);
    box-shadow: inset 0 0 0 1px var(--color-accent);
    border-radius: 4px;
  }

  .row.being-dragged {
    opacity: 0.45;
  }

  .row:hover {
    background: var(--color-hover);
    color: var(--color-text);
  }

  .row.active {
    background: var(--color-hover);
    color: var(--color-text);
    font-weight: 600;
  }

  .chevron,
  .chevron-spacer {
    display: inline-flex;
    width: 13px;
    flex-shrink: 0;
  }

  .chevron {
    transition: transform 0.12s ease;
  }

  .chevron.expanded {
    transform: rotate(90deg);
  }

  .name {
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
  }

  .row-actions {
    display: flex;
    gap: 2px;
    flex-shrink: 0;
  }

  .row-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    padding: 0;
    border: none;
    background: transparent;
    border-radius: 3px;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .row-btn:hover {
    background: var(--color-border);
    color: var(--color-text);
  }

  .loading {
    font-size: 0.78rem;
    color: var(--color-text-muted);
    font-style: italic;
    padding-top: 4px;
    padding-bottom: 4px;
  }
</style>
