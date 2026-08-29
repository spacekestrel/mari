<script lang="ts">
  import { onMount } from "svelte";

  interface Props {
    title: string;
    message: string;
    confirmLabel?: string;
    /** Red for destructive answers, accented for ordinary ones like "Save". */
    confirmTone?: "danger" | "primary";
    /** Only the delete flow offers to stop asking. */
    showDontAskAgain?: boolean;
    /** A third answer, between Cancel and confirm — "Discard", say. */
    altLabel?: string;
    onAlt?: () => void;
    onConfirm: (dontAskAgain: boolean) => void;
    onCancel: () => void;
  }

  let {
    title,
    message,
    confirmLabel = "Delete",
    confirmTone = "danger",
    showDontAskAgain = true,
    altLabel,
    onAlt,
    onConfirm,
    onCancel,
  }: Props = $props();

  let dontAskAgain = $state(false);
  let dialogEl: HTMLDivElement;

  onMount(() => dialogEl?.focus());

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      onCancel();
    }
  }
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="scrim" role="presentation" onclick={onCancel}>
  <!-- svelte-ignore a11y_click_events_have_key_events -->
  <div
    class="dialog"
    bind:this={dialogEl}
    onclick={(e) => e.stopPropagation()}
    role="alertdialog"
    aria-modal="true"
    aria-labelledby="confirm-dialog-title"
    tabindex="-1"
  >
    <h2 id="confirm-dialog-title" class="title">{title}</h2>
    <p class="message">{message}</p>
    {#if showDontAskAgain}
      <label class="checkbox-row">
        <input type="checkbox" bind:checked={dontAskAgain} />
        Don't ask again
      </label>
    {/if}
    <div class="actions" class:spaced={!showDontAskAgain}>
      <button class="btn" onclick={onCancel}>Cancel</button>
      {#if altLabel}
        <button class="btn" onclick={() => onAlt?.()}>{altLabel}</button>
      {/if}
      <button
        class="btn"
        class:btn-danger={confirmTone === "danger"}
        class:btn-primary={confirmTone === "primary"}
        onclick={() => onConfirm(dontAskAgain)}>{confirmLabel}</button
      >
    </div>
  </div>
</div>

<style>
  .scrim {
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 100;
  }

  .dialog {
    width: 300px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: 12px;
    padding: var(--space-4);
    box-shadow: 0 20px 50px rgba(0, 0, 0, 0.25);
  }

  .title {
    font-size: 0.95rem;
    font-weight: 600;
    color: var(--color-text);
    margin: 0 0 6px;
  }

  .message {
    font-size: 0.82rem;
    line-height: 1.5;
    color: var(--color-text-muted);
    margin: 0 0 var(--space-3);
  }

  .checkbox-row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 0.8rem;
    color: var(--color-text-muted);
    margin-bottom: var(--space-4);
    cursor: pointer;
  }

  .actions {
    display: flex;
    justify-content: flex-end;
    gap: var(--space-2);
  }

  .btn {
    border: 1px solid var(--color-border);
    background: var(--color-bg);
    color: var(--color-text);
    padding: 6px 14px;
    border-radius: 6px;
    font-size: 0.82rem;
    cursor: pointer;
  }

  .btn:hover {
    background: var(--color-hover);
  }

  .btn-danger {
    background: #e5484d;
    border-color: #e5484d;
    color: white;
  }

  .btn-danger:hover {
    background: #d63c41;
  }

  .btn-primary {
    background: var(--color-action);
    border-color: var(--color-action);
    color: white;
  }

  .btn-primary:hover {
    background: var(--color-action-hover);
    border-color: var(--color-action-hover);
  }

  /* Without the checkbox above them the buttons sit too close to the message. */
  .actions.spaced {
    margin-top: var(--space-4);
  }
</style>
