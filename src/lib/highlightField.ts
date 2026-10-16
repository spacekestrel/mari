import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { StateEffect, StateField, type Range } from "@codemirror/state";
import type { StoredHighlight } from "./highlightStore";

/**
 * Revision marks as CodeMirror state: where each marked passage is, what state
 * it's in, and the identity that ties it to its notes and draft history.
 *
 * Kept out of the editor component because the splitting rules below are
 * fiddly and have been got wrong before — marking a few words inside a long
 * marked passage used to wipe that whole passage's mark. Out here they can be
 * tested without a browser.
 */

const CLASS_PREFIX = "cm-highlight-";

/** Applies a state over a range, or clears it when `stateId` is null. */
export const setHighlight = StateEffect.define<{
  from: number;
  to: number;
  stateId: string | null;
  id: string;
}>();

/** Wipes every mark — used when swapping in a different file's content. */
export const clearHighlights = StateEffect.define<null>();

/**
 * Removes exactly one chunk. Used once a Reposition move completes: the mark's
 * job is done, and unlike a blanket clear this must never touch anything else.
 */
export const clearHighlightById = StateEffect.define<string>();

export function makeHighlightMark(stateId: string, id: string) {
  // `data-chunk-id` puts the chunk's identity on the rendered span itself, so
  // hover can be resolved by asking the DOM what's under the pointer instead
  // of converting mouse coordinates back into a document position — that
  // coordinate round-trip is what made hover detection unreliable.
  return Decoration.mark({
    class: `${CLASS_PREFIX}${stateId}`,
    id,
    attributes: { "data-chunk-id": id },
  });
}

/** The state and identity carried by a decoration, if it is one of ours. */
function readMark(deco: Decoration): { stateId: string; id: string } | null {
  const spec = deco.spec as { class?: string; id?: string };
  const cls = spec.class ?? "";
  if (!cls.startsWith(CLASS_PREFIX)) return null;
  return { stateId: cls.slice(CLASS_PREFIX.length), id: spec.id ?? crypto.randomUUID() };
}

function decorationsFrom(highlights: StoredHighlight[]): DecorationSet {
  const ranges: Range<Decoration>[] = highlights
    .filter((h) => h.to > h.from)
    .map((h) => makeHighlightMark(h.stateId, h.id).range(h.from, h.to));
  return ranges.length ? Decoration.none.update({ add: ranges, sort: true }) : Decoration.none;
}

/**
 * Applies one mark over `from`–`to`, trimming anything it overlaps rather than
 * dropping it. A mark that is only partly covered keeps its uncovered parts;
 * one that is covered end to end goes.
 */
function applyOver(
  decorations: DecorationSet,
  from: number,
  to: number,
  stateId: string | null,
  id: string,
): DecorationSet {
  const survivors: Range<Decoration>[] = [];

  decorations.between(from, to, (dFrom, dTo, deco) => {
    // Only ranges the filter below actually drops; one merely touching the
    // boundary is kept as-is and must not be re-added here too.
    if (!(dTo > from && dFrom < to)) return;
    const mark = readMark(deco);
    if (!mark) return;

    const leftTo = Math.min(dTo, from);
    const rightFrom = Math.max(dFrom, to);
    const hasLeft = leftTo > dFrom;
    const hasRight = dTo > rightFrom;

    if (hasLeft && hasRight) {
      // Split in two: the bigger piece inherits the original id (and so keeps
      // this chunk's draft history); the smaller becomes its own.
      const leftKeepsId = leftTo - dFrom >= dTo - rightFrom;
      survivors.push(
        makeHighlightMark(mark.stateId, leftKeepsId ? mark.id : crypto.randomUUID()).range(dFrom, leftTo),
        makeHighlightMark(mark.stateId, leftKeepsId ? crypto.randomUUID() : mark.id).range(rightFrom, dTo),
      );
    } else if (hasLeft) {
      survivors.push(makeHighlightMark(mark.stateId, mark.id).range(dFrom, leftTo));
    } else if (hasRight) {
      survivors.push(makeHighlightMark(mark.stateId, mark.id).range(rightFrom, dTo));
    }
  });

  decorations = decorations.update({ filter: (dFrom, dTo) => dTo <= from || dFrom >= to });
  const add = stateId ? [...survivors, makeHighlightMark(stateId, id).range(from, to)] : survivors;
  return add.length > 0 ? decorations.update({ add, sort: true }) : decorations;
}

/**
 * Seeded from whatever the caller holds at the moment the field is created —
 * correct both for a first mount and for a from-scratch rebuild, since the
 * whole thing is constructed fresh each time.
 */
export function createHighlightField(initialHighlights: StoredHighlight[]): StateField<DecorationSet> {
  return StateField.define<DecorationSet>({
    create() {
      return decorationsFrom(initialHighlights);
    },
    update(decorations, tr) {
      decorations = decorations.map(tr.changes);
      for (const effect of tr.effects) {
        if (effect.is(clearHighlights)) {
          decorations = Decoration.none;
        } else if (effect.is(clearHighlightById)) {
          const targetId = effect.value;
          decorations = decorations.update({
            filter: (_from, _to, deco) => (deco.spec as { id?: string }).id !== targetId,
          });
        } else if (effect.is(setHighlight)) {
          const { from, to, stateId, id } = effect.value;
          decorations = applyOver(decorations, from, to, stateId, id);
        }
      }
      return decorations;
    },
    provide: (field) => EditorView.decorations.from(field),
  });
}

/** Every mark currently in the document, in document order. */
export function readHighlights(decorations: DecorationSet, docLength: number): StoredHighlight[] {
  const result: StoredHighlight[] = [];
  decorations.between(0, docLength, (from, to, deco) => {
    const mark = readMark(deco);
    if (mark) result.push({ from, to, stateId: mark.stateId, id: mark.id });
  });
  return result;
}

/** The mark covering `pos`, if there is one. */
export function markAt(
  decorations: DecorationSet,
  pos: number,
): (StoredHighlight & { stateId: string }) | null {
  let found: StoredHighlight | null = null;
  decorations.between(pos, pos, (from, to, deco) => {
    const mark = readMark(deco);
    if (mark) found = { from, to, stateId: mark.stateId, id: mark.id };
  });
  return found;
}
