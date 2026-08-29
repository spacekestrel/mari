<script lang="ts">
  import Icon from "./Icon.svelte";
  import type { MariPlanBeat } from "$lib/mariBundle";
  import { beatsToLines, mergePlanBeats, samePlan } from "$lib/plan";

  /**
   * The chapter's header, tucked into the top-left corner of the document.
   * At rest it's two words. Clicking one opens it: a box to write in if it's
   * empty, or what you already wrote if it isn't.
   */
  interface Props {
    /** Ordered beats — what this chapter has to get done. */
    plan: MariPlanBeat[];
    /** What actually happens, in a sentence or two. */
    synopsis: string;
    onPlanChange: (beats: MariPlanBeat[]) => void;
    onSynopsisChange: (text: string) => void;
    /** How many cut passages are sitting in the drawer. */
    drawerCount: number;
    onOpenDrawer: () => void;
    /** Fired when the synopsis or plan unfolds, so the drawer can shut. */
    onOpenField: () => void;
  }

  let { plan, synopsis, onPlanChange, onSynopsisChange, drawerCount, onOpenDrawer, onOpenField }: Props =
    $props();

  type Field = "synopsis" | "plan";

  let open = $state<Field | null>(null);
  let editing = $state(false);
  let draft = $state("");
  let textarea = $state<HTMLTextAreaElement | undefined>();
  let root = $state<HTMLDivElement | undefined>();

  const steps = $derived(plan.filter((beat) => beat.text.trim().length > 0));
  const summary = $derived(synopsis.trim());

  const isEmpty = (field: Field) => (field === "plan" ? steps.length === 0 : summary === "");

  function toggle(field: Field) {
    // Keep whatever is in the box first. Clicking the open word to put it
    // away, or the other word to switch, both used to discard it silently.
    // Must run before `open` moves — applyDraft reads it to know which field
    // it's writing.
    if (editing) applyDraft();

    if (open === field) {
      open = null;
      editing = false;
      return;
    }
    open = field;
    onOpenField();
    // Nothing written yet means there's nothing to read — go straight to the box.
    if (isEmpty(field)) startEditing();
    else editing = false;
  }

  function startEditing() {
    if (!open) return;
    draft = open === "plan" ? beatsToLines(steps) : summary;
    editing = true;
    // Focus once the textarea exists.
    queueMicrotask(() => textarea?.focus());
  }

  /** Writes the draft back to the caller. Doesn't touch what's on screen. */
  function applyDraft() {
    if (!open) return;

    if (open === "plan") {
      const next = mergePlanBeats(draft, steps);
      // Only report a real change — otherwise opening and closing the box
      // would mark the file unsaved.
      if (!samePlan(next, steps)) onPlanChange(next);
    } else {
      const next = draft.trim();
      if (next !== summary) onSynopsisChange(next);
    }
  }

  /**
   * Hands over whatever is in the box right now, leaving it open so typing
   * isn't interrupted. Saving calls this: Ctrl+S doesn't move focus, so
   * without it a plan typed and saved in one go would be written out empty.
   */
  export function flush() {
    if (editing) applyDraft();
  }

  function commit() {
    if (!open) return;
    const wasBlank = draft.trim() === "";
    applyDraft();
    editing = false;
    // Left it blank: there's nothing to show, so don't leave an empty box open.
    if (wasBlank) open = null;
  }

  function close() {
    // Save first: the click that closes us may well be a click into the prose,
    // and nobody expects that to throw away what they just typed.
    if (editing) commit();
    open = null;
    editing = false;
  }

  // Clicking anywhere else puts it away. Pointerdown rather than click, so it
  // lands before the textarea's own blur and there's only one commit.
  $effect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Node && root?.contains(target)) return;
      close();
    };
    document.addEventListener("pointerdown", onPointerDown, true);
    return () => document.removeEventListener("pointerdown", onPointerDown, true);
  });

  /** Ticking a beat off is a one-click thing; it never opens the editor. */
  function toggleBeat(index: number) {
    onPlanChange(steps.map((beat, i) => (i === index ? { ...beat, done: !beat.done } : beat)));
  }

  function onFieldKeydown(event: KeyboardEvent) {
    if (event.key === "Escape") {
      // The editor binds Escape too; this one is ours.
      event.stopPropagation();
      close();
    }
  }
</script>

{#snippet field(name: Field, label: string, placeholder: string)}
  <button
    class="label"
    class:active={open === name}
    data-chapter-label
    onclick={() => toggle(name)}>{label}</button>

  {#if open === name}
    <div class="panel">
      {#if editing}
        <textarea
          bind:this={textarea}
          bind:value={draft}
          {placeholder}
          rows={name === "plan" ? Math.max(3, steps.length + 1) : 3}
          onblur={commit}
          onkeydown={onFieldKeydown}
        ></textarea>
      {:else}
        <div class="written">
          {#if name === "plan"}
            <ul class="beats">
              {#each steps as beat, i}
                <li class="beat" class:done={beat.done}>
                  <span
                    class="dot"
                    role="checkbox"
                    tabindex="0"
                    aria-checked={beat.done ? "true" : "false"}
                    aria-label={beat.text}
                    onclick={(event) => {
                      // The row behind this opens the editor; ticking must not.
                      event.stopPropagation();
                      toggleBeat(i);
                    }}
                    onkeydown={(event) => {
                      if (event.key !== "Enter" && event.key !== " ") return;
                      event.preventDefault();
                      event.stopPropagation();
                      toggleBeat(i);
                    }}
                  ></span>
                  <span class="beat-text">{beat.text}</span>
                </li>
              {/each}
            </ul>
          {:else}
            <p>{summary}</p>
          {/if}
        </div>
        <button class="pencil" onclick={startEditing} title="Edit">
          <Icon name="pencil" size={12} />
        </button>
      {/if}
    </div>
  {/if}
{/snippet}

<div class="header" bind:this={root} data-panel-open={open ? "" : undefined}>
  {@render field("synopsis", "Synopsis", "What happens in this chapter?")}
  {@render field("plan", "Plan", "One step per line")}

  <!-- Same category as the two above — things about the chapter that aren't
       the prose — so it sits with them rather than in the app's toolbar. This
       one opens the side panel instead of unfolding here. -->
  <button
    class="label"
    data-chapter-label
    onclick={() => {
      // Only one of the three should ever be unfolded at a time.
      close();
      onOpenDrawer();
    }}
  >
    Drawer{drawerCount ? ` (${drawerCount})` : ""}
  </button>
</div>

<style>
  /* Everything here borrows the sidebar's voice: same family, same size, same
     muted-until-you-touch-it colour. */
  /* The prose scrolls under this now, so it needs to sit on the page colour
     rather than be transparent. The negative margins put the text back where
     it was before the padding was added. */
  .header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 1px;
    margin: -6px 0 0 -10px;
    padding: 6px 10px;
    border-radius: var(--radius);
    background: var(--color-bg);
    font-family: var(--font-ui);
    font-size: 0.82rem;
    line-height: 1.5;
  }

  .label {
    padding: 1px 0;
    border: none;
    background: none;
    color: var(--color-text-muted);
    font: inherit;
    cursor: pointer;
    user-select: none;
    transition: color 0.12s ease;
  }

  .label:hover,
  .label.active {
    color: var(--color-text);
  }

  /* Sits under its own word, pushing the words below it down. The prose stays
     put regardless: the editor reserves the header's *resting* height, not
     whatever it grows to when one of these is unfolded. */
  .panel {
    display: flex;
    align-items: flex-start;
    gap: var(--space-2);
    width: 320px;
    max-width: 60vw;
    margin: 2px 0 6px;
    padding: var(--space-3);
    border: 1px solid var(--color-border);
    border-radius: var(--radius);
    background: var(--color-surface);
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.14);
  }

  .written {
    flex: 1;
    min-width: 0;
    color: var(--color-text);
  }

  /* The same rule the plan's beats hang off, without the dots — so the two
     read as one family: a line down the side of what the chapter is. */
  .written p {
    position: relative;
    margin: 0;
    padding-left: 16px;
    line-height: 1.65;
  }

  .written p::before {
    content: "";
    position: absolute;
    left: 4px;
    top: 4px;
    bottom: 4px;
    width: 1px;
    background: var(--color-border);
  }

  /* A spine with a dot per beat: this is a sequence running through the
     chapter, not a bulleted list of unrelated things. */
  .beats {
    position: relative;
    margin: 0;
    padding: 0 0 0 16px;
    list-style: none;
  }

  .beats::before {
    content: "";
    position: absolute;
    left: 4px;
    top: 8px;
    bottom: 8px;
    width: 1px;
    background: var(--color-border);
  }

  .beat {
    position: relative;
    padding: 1px 0;
  }

  .dot {
    position: absolute;
    left: -16px;
    top: 6px;
    width: 9px;
    height: 9px;
    box-sizing: border-box;
    border: 1px solid var(--color-text-muted);
    border-radius: 50%;
    /* Sits on the spine, so it has to hide the line behind it. */
    background: var(--color-bg);
    cursor: pointer;
    transition:
      background 0.12s ease,
      border-color 0.12s ease;
  }

  .dot:hover {
    border-color: var(--color-accent);
  }

  .beat.done .dot {
    background: var(--color-accent);
    border-color: var(--color-accent);
  }

  /* Done beats stay legible but stop competing with what's still to write. */
  .beat.done .beat-text {
    opacity: 0.5;
  }

  .pencil {
    display: inline-flex;
    flex-shrink: 0;
    padding: 2px;
    border: none;
    border-radius: 4px;
    background: none;
    color: var(--color-text-muted);
    cursor: pointer;
  }

  .pencil:hover {
    color: var(--color-text);
    background: var(--color-hover);
  }

  textarea {
    display: block;
    width: 100%;
    padding: 6px 8px;
    resize: vertical;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    background: var(--color-surface);
    color: var(--color-text);
    font: inherit;
  }

  textarea:focus {
    outline: none;
    border-color: var(--color-accent);
  }
</style>
