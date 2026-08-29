<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    depth: number;
    placeholder: string;
    onConfirm: (name: string) => void;
    onCancel: () => void;
  }

  let { depth, placeholder, onConfirm, onCancel }: Props = $props();

  let value = $state("");
  let inputEl: HTMLInputElement;
  let settled = false;

  onMount(() => inputEl?.focus());

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Enter") {
      const name = value.trim();
      if (!name) return;
      settled = true;
      onConfirm(name);
    } else if (e.key === "Escape") {
      settled = true;
      onCancel();
    }
  }

  function handleBlur() {
    if (!settled) {
      settled = true;
      onCancel();
    }
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
