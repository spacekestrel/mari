<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    depth: number;
    placeholder: string;
    onConfirm: (name: string) => void;
    onCancel: () => void;
    /** The name being changed, when this is a rename rather than a new file. */
    initial?: string;
    /**
     * The part of `initial` to select, so renaming a chapter doesn't mean
     * retyping `.mari`. Left out, the whole thing is selected.
     */
    select?: { from: number; to: number };
  }

  let { depth, placeholder, onConfirm, onCancel, initial = "", select }: Props = $props();

  // Taken once on purpose: from here the box is the writer's to edit, and a
  // fresh one is mounted for each rename, so there is nothing to follow.
  // svelte-ignore state_referenced_locally
  let value = $state(initial);
  let inputEl: HTMLInputElement;
  let settled = false;

  onMount(() => {
    inputEl?.focus();
    // Only the part worth changing, the way a file manager does it. The
    // extension stays in the box but out of the way of the next keystroke.
    if (initial) inputEl?.setSelectionRange(select?.from ?? 0, select?.to ?? initial.length);
  });

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      const name = value.trim();
      if (!name) return;
      settled = true;
      onConfirm(name);
      return;
    } else if (e.key === "Escape") {
      settled = true;
      onCancel();
    }
  }

  function handleBlur() {
    if (settled) return;
    settled = true;
    // Committing on blur the way a file manager does: clicking away from a
    // name you have just typed should keep it, not throw it away. An unchanged
    // name is handled upstream and costs nothing.
    const name = value.trim();
    if (initial && name) onConfirm(name);
    else onCancel();
  }
</script>

<div class="inline-row" style="padding-left: {depth * 14 + 8}px">
  <input bind:this={inputEl} bind:value {placeholder} onkeydown={handleKeydown} onblur={handleBlur} />
</div>

<style>
  .inline-row {
    padding: 2px var(--space-2) 2px 8px;
  }

  input {
    width: 100%;
    font-family: inherit;
    font-size: 0.82rem;
    color: var(--color-text);
    background: var(--color-bg);
    border: 1px solid var(--color-accent);
    border-radius: 4px;
    padding: 2px 6px;
    outline: none;
  }
</style>
