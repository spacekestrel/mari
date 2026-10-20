import { Decoration, EditorView, type DecorationSet } from "@codemirror/view";
import { StateEffect, StateField, type Extension, type Range } from "@codemirror/state";

/**
 * Holding the chapter back while one passage is being rewritten.
 *
 * With the drafting panel open there are two versions of the same passage on
 * screen at once, and the prose around it is no longer the thing being worked
 * on — it is there for context. So everything but the passage under the panel
 * is held back, and the passage itself stays at full strength. It is the same
 * idea as focus mode, narrowed from the chapter to the paragraph.
 *
 * Done by dimming what is *around* the passage rather than dimming the page
 * and brightening the passage back up. Opacity on a parent cannot be undone by
 * a child — once the prose is faded, nothing inside it can be made solid again
 * — so the fade has to go on the two stretches either side instead.
 */

/** The passage to leave at full strength, or null to let the whole chapter back up. */
export const setSpotlight = StateEffect.define<{ from: number; to: number } | null>();

/**
 * The two stretches of prose to hold back: everything before the passage, and
 * everything after it.
 *
 * Either can come back empty — a passage at the very top of a chapter has
 * nothing above it — and an empty one is left out rather than added as a range
 * covering nothing.
 */
export function dimRanges(
  docLength: number,
  spotlight: { from: number; to: number } | null,
): { from: number; to: number }[] {
  // No passage named, or one with nothing in it: the chapter stays as it is.
  // Dimming everything around an empty passage would fade the lot.
  if (!spotlight || spotlight.to <= spotlight.from) return [];

  const from = Math.max(0, Math.min(spotlight.from, docLength));
  const to = Math.max(from, Math.min(spotlight.to, docLength));

  const ranges: { from: number; to: number }[] = [];
  if (from > 0) ranges.push({ from: 0, to: from });
  if (to < docLength) ranges.push({ from: to, to: docLength });
  return ranges;
}

const DIMMED = Decoration.mark({ class: "cm-dimmed" });

/**
 * Which passage is being rewritten, kept in editor state so it rides along
 * with every edit — the writer can go on typing in the chapter behind the
 * panel, and the passage has to stay lit where it actually is.
 */
export const spotlightField = StateField.define<{ from: number; to: number } | null>({
  create() {
    return null;
  },
  update(spotlight, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setSpotlight)) return effect.value;
    }
    if (!spotlight) return null;
    /**
     * Both ends lean outwards, so words typed right up against the passage
     * stay outside it. The lit region is the passage that was opened, and it
     * should not creep outwards every time something is typed at its edge —
     * the panel is still showing the wording it started with.
     *
     * Typing *inside* the passage does widen it, which is only the range
     * following its own text.
     */
    return {
      from: tr.changes.mapPos(spotlight.from, 1),
      to: tr.changes.mapPos(spotlight.to, -1),
    };
  },
});

const dimDecorations = EditorView.decorations.compute([spotlightField, "doc"], (state) => {
  const ranges = dimRanges(state.doc.length, state.field(spotlightField));
  if (ranges.length === 0) return Decoration.none;
  const marks: Range<Decoration>[] = ranges.map((range) => DIMMED.range(range.from, range.to));
  return Decoration.set(marks, true);
});

/** Dims the chapter around the passage being rewritten. */
export function spotlightPassage(): Extension {
  return [
    spotlightField,
    dimDecorations,
    EditorView.theme({
      /**
       * Far enough back to settle, near enough to still be read — the prose
       * around the passage is context, not clutter, and a writer checking
       * whether a rewrite still fits its surroundings has to be able to read
       * them.
       */
      ".cm-dimmed": { opacity: "0.35" },
    }),
  ];
}
