import { Decoration, EditorView, ViewPlugin, type DecorationSet } from "@codemirror/view";
import {
  RangeSet,
  RangeValue,
  StateEffect,
  StateField,
  Text,
  type EditorState,
  type Extension,
  type Range,
} from "@codemirror/state";
import { invertedEffects } from "@codemirror/commands";
import { readHighlights } from "./highlightField";
import { HIGHLIGHT_STATES, migrateStateId } from "./highlightStates";
import type { StoredHighlight } from "./highlightStore";
import type { ChunkVersion } from "./chunkHistory";

/**
 * Brackets down the margin, beside passages that have been reworked.
 *
 * Replacing a passage clears the mark that asked for the rewrite: the work is
 * done, and leaving a to-do on finished prose would be wrong. But the earlier
 * wordings are still in the file, and with the mark gone there was nothing
 * left to say where they belonged: the passage looked like every other
 * paragraph, so the one thing you could not do was find your way back to what
 * it used to say.
 *
 * So a reworked passage keeps a quieter mark of its own. It carries no verdict
 * and no colour. It only says *this is a passage you have already been
 * through, and there is history behind it*. A bracket in the margin rather
 * than anything over the prose, because the prose has been settled.
 *
 * Kept out of the editor component so the two decisions worth getting right
 * (which passages earn a bracket, and which lines it is drawn beside) can be
 * tested without a browser.
 */

/** Where a reworked passage sits, and which chunk's history belongs to it. */
export interface StoredWorked {
  id: string;
  from: number;
  to: number;
}

/**
 * The chunk id, carried on the range so it survives every edit around it. The
 * id is the whole point: it is what ties the bracket to the versions stored
 * against that passage.
 */
class WorkedMark extends RangeValue {
  constructor(readonly id: string) {
    super();
  }

  eq(other: RangeValue): boolean {
    return other instanceof WorkedMark && other.id === this.id;
  }
}

/** Records a reworked passage. */
export const setWorked = StateEffect.define<StoredWorked>();

/** Drops one, for a passage that is no longer worth marking. */
export const clearWorkedById = StateEffect.define<string>();

/** Wipes the lot, as swapping in another file's content does. */
export const clearWorked = StateEffect.define<null>();

function rangesFrom(worked: StoredWorked[]): Range<WorkedMark>[] {
  return worked.filter((w) => w.to > w.from && w.id).map((w) => new WorkedMark(w.id).range(w.from, w.to));
}

/**
 * Whether a passage covers at least one whole line of the chapter.
 *
 * The bracket is drawn beside lines, so it can only honestly mark whole ones.
 * A few words from the middle of a paragraph would put a bracket against the
 * entire paragraph and claim far more than was actually reworked, so those
 * don't get one.
 */
export function coversWholeLine(doc: Text, from: number, to: number): boolean {
  if (to <= from) return false;
  // A hand-edited file can carry positions that were never in this chapter.
  if (from < 0 || from > doc.length) return false;
  const first = doc.lineAt(from).number;
  const last = doc.lineAt(Math.min(to, doc.length)).number;
  for (let n = first; n <= last; n += 1) {
    const line = doc.line(n);
    if (line.from >= from && line.to <= to) return true;
  }
  return false;
}

/**
 * Working out the brackets for a chapter saved before brackets existed.
 *
 * Those files never recorded where a reworked passage sat: the highlight was
 * holding the place, and replacing the passage cleared it. So for most of them
 * the position is simply gone, and nothing here invents one.
 *
 * But not all of them. Replacing offers to leave the passage marked, and when
 * it was, the highlight stayed behind carrying the same chunk id. Those two
 * facts together (a highlight here, earlier wordings under that same id) are
 * enough to say exactly where the work was done, so those passages get their
 * brackets back rather than being written off with the rest.
 *
 * Only reworks. A passage with nothing but a move behind it was carried from
 * one place to another, not rewritten, and a bracket would claim otherwise.
 */
export function inferWorked(
  text: string,
  highlights: StoredHighlight[],
  history: Record<string, ChunkVersion[]>,
): StoredWorked[] {
  const doc = Text.of(text.split("\n"));
  const found: StoredWorked[] = [];
  const seen = new Set<string>();

  for (const highlight of highlights) {
    if (!highlight.id || seen.has(highlight.id)) continue;
    const versions = history[highlight.id];
    // `kind` arrived with Reposition; before that every version was a rework,
    // so one written without it is read as one rather than discarded.
    if (!versions?.some((version) => version.kind !== "moved")) continue;
    if (!coversWholeLine(doc, highlight.from, highlight.to)) continue;
    seen.add(highlight.id);
    found.push({ id: highlight.id, from: highlight.from, to: highlight.to });
  }

  return found;
}

/**
 * A passage that earns a bracket, and what colour it shows when pointed at.
 *
 * Two kinds end up here. A passage you have marked, which has a colour of its
 * own; and one you have reworked, whose mark was cleared when the work was
 * done and so has none left to show.
 */
export interface BracketSource extends StoredWorked {
  /** The mark's colour, or absent for a passage with no mark on it. */
  color?: string;
}

/**
 * Every passage in the chapter with a bracket beside it: the marked ones and
 * the reworked ones together.
 *
 * Marked ones first, so a passage that is both reworked and left marked
 * afterwards is listed once and keeps the colour it is wearing now rather
 * than being counted twice.
 */
export function bracketSources(
  state: EditorState,
  worked: StateField<RangeSet<WorkedMark>>,
  highlights: StateField<DecorationSet>,
): BracketSource[] {
  const sources: BracketSource[] = [];
  const seen = new Set<string>();

  for (const mark of readHighlights(state.field(highlights), state.doc.length)) {
    if (!coversWholeLine(state.doc, mark.from, mark.to)) continue;
    const info = HIGHLIGHT_STATES.find((s) => s.id === migrateStateId(mark.stateId));
    sources.push({ id: mark.id, from: mark.from, to: mark.to, color: info?.solid });
    seen.add(mark.id);
  }

  for (const passage of readWorked(state.field(worked), state.doc.length)) {
    if (!seen.has(passage.id)) sources.push(passage);
  }

  return sources;
}

/** One line of a bracket: the stroke, plus an arm where the passage begins or ends. */
export interface BracketLine {
  /** Start of the line the stroke is drawn beside. */
  from: number;
  first: boolean;
  last: boolean;
  /**
   * The passage this line belongs to. Put on the rendered line so a click out
   * in the margin can be traced back to a passage, which is the only thing
   * there to aim at: the bracket is beside the prose, not in it.
   */
  id: string;
  /** True for the passage currently being looked at, which draws it stronger. */
  active: boolean;
  /** The mark's colour, shown when the bracket is pointed at. */
  color?: string;
}

/** Which passage the brackets should draw as the one being looked at. */
export const setActiveWorked = StateEffect.define<string | null>();

/**
 * The passage whose bracket is lit up, held in editor state rather than beside
 * it. The brackets are redrawn whenever the lines on screen change, and
 * anything kept outside would be lost on the next redraw.
 */
export const activeWorkedField = StateField.define<string | null>({
  create() {
    return null;
  },
  update(active, tr) {
    for (const effect of tr.effects) {
      if (effect.is(setActiveWorked)) return effect.value;
    }
    return active;
  },
});

/**
 * The lines a set of reworked passages puts a bracket beside, in order.
 *
 * Only the lines on screen: a chapter can hold any number of these, and there
 * is nothing to draw for the ones scrolled out of sight.
 *
 * Where two passages meet on the same line, that line gets both arms. They are
 * two separate pieces of work, and drawing them as one would say otherwise.
 */
export function bracketLines(
  doc: Text,
  worked: BracketSource[],
  visibleFrom: number,
  visibleTo: number,
  activeId: string | null = null,
): BracketLine[] {
  const lines = new Map<number, Omit<BracketLine, "from">>();

  for (const passage of worked) {
    if (passage.to <= passage.from) continue;
    if (passage.to < visibleFrom || passage.from > visibleTo) continue;

    const firstLine = doc.lineAt(passage.from).number;
    // A passage ending exactly where the next line starts belongs to the line
    // it was written on, not to the one after it.
    const lastLine = doc.lineAt(Math.max(passage.from, Math.min(passage.to, doc.length) - 1)).number;
    const active = !!activeId && passage.id === activeId;

    for (let n = firstLine; n <= lastLine; n += 1) {
      const line = doc.line(n);
      if (line.to < visibleFrom || line.from > visibleTo) continue;
      const already = lines.get(line.from);
      lines.set(line.from, {
        first: (already?.first ?? false) || n === firstLine,
        last: (already?.last ?? false) || n === lastLine,
        // Where two passages share a line, the one being looked at owns it:
        // it is the one the writer is aiming at, so it takes both the colour
        // and the click.
        id: already?.active ? already.id : active ? passage.id : (already?.id ?? passage.id),
        active: (already?.active ?? false) || active,
        // Follows the id above: whichever passage owns the line owns its colour.
        color: already?.active ? already.color : active ? passage.color : (already?.color ?? passage.color),
      });
    }
  }

  return [...lines.entries()]
    .map(([from, rest]) => ({ from, ...rest }))
    .sort((a, b) => a.from - b.from);
}

/**
 * Seeded from whatever the caller holds when the field is built, for the same
 * reason the highlights are: the whole editor is constructed fresh on a file
 * switch, and a field that started empty would be saved back over the file.
 */
export function createWorkedField(initial: StoredWorked[]): StateField<RangeSet<WorkedMark>> {
  return StateField.define<RangeSet<WorkedMark>>({
    create() {
      return RangeSet.of(rangesFrom(initial), true);
    },
    update(worked, tr) {
      worked = worked.map(tr.changes);
      // A passage edited down to nothing has no lines left to stand beside.
      worked = worked.update({ filter: (from, to) => to > from });

      for (const effect of tr.effects) {
        if (effect.is(clearWorked)) {
          worked = RangeSet.empty;
        } else if (effect.is(clearWorkedById)) {
          const id = effect.value;
          worked = worked.update({ filter: (_from, _to, value) => value.id !== id });
        } else if (effect.is(setWorked)) {
          const next = effect.value;
          // One bracket per passage: reworking the same passage again moves
          // its bracket rather than stacking a second one on top.
          worked = worked.update({
            filter: (_from, _to, value) => value.id !== next.id,
            add: rangesFrom([next]),
            sort: true,
          });
        }
      }
      return worked;
    },
  });
}

/** Every reworked passage currently in the chapter, in order. */
export function readWorked(worked: RangeSet<WorkedMark>, docLength: number): StoredWorked[] {
  const result: StoredWorked[] = [];
  worked.between(0, docLength, (from, to, value) => {
    result.push({ id: value.id, from, to });
  });
  return result;
}

/** The reworked passage covering `pos`, if there is one. */
export function workedAt(worked: RangeSet<WorkedMark>, pos: number): StoredWorked | null {
  let found: StoredWorked | null = null;
  worked.between(pos, pos, (from, to, value) => {
    if (!found) found = { id: value.id, from, to };
  });
  return found;
}

/** A reworked passage by name, for a click that arrived knowing only the id. */
export function workedById(
  worked: RangeSet<WorkedMark>,
  docLength: number,
  id: string,
): StoredWorked | null {
  let found: StoredWorked | null = null;
  worked.between(0, docLength, (from, to, value) => {
    if (!found && value.id === id) found = { id: value.id, from, to };
  });
  return found;
}

/** Marks the rendered line a bracket belongs to, so a margin click can be placed. */
export const WORKED_LINE_ATTR = "data-worked-id";

/**
 * Brackets come back when a deletion is undone, and go away when the rework
 * that earned one is undone. Same reasoning as the marks (see
 * highlightsFollowUndo), with one more case of its own.
 *
 * A Replace puts a bracket on in the same breath as it changes the prose, so
 * undoing it has to take the bracket off again. Otherwise the margin would go
 * on claiming a passage had been reworked after the rework was taken back.
 */
export function bracketsFollowUndo(field: StateField<RangeSet<WorkedMark>>): Extension {
  return invertedEffects.of((tr) => {
    const restore: StateEffect<unknown>[] = [];
    const before = tr.startState.field(field);
    const lengthBefore = tr.startState.doc.length;

    for (const effect of tr.effects) {
      if (effect.is(setWorked)) {
        // Back to where it was, or off altogether if it wasn't there before.
        const previous = workedById(before, lengthBefore, effect.value.id);
        restore.push(previous ? setWorked.of(previous) : clearWorkedById.of(effect.value.id));
      } else if (effect.is(clearWorkedById)) {
        const previous = workedById(before, lengthBefore, effect.value);
        if (previous) restore.push(setWorked.of(previous));
      }
    }

    if (!tr.changes.empty) {
      tr.changes.iterChangedRanges((fromA, toA) => {
        before.between(fromA, toA, (from, to, value) => {
          if (from < fromA || to > toA) return;
          restore.push(setWorked.of({ id: value.id, from, to }));
        });
      });
    }

    return restore;
  });
}

const STROKE = "2px solid var(--color-text-muted)";
/** The clicked bracket's colour: its passage's mark, or the accent if it has none. */
const ACTIVE_STROKE_COLOR = "var(--worked-color, var(--color-accent))";

/**
 * Draws the brackets. A view plugin rather than the field itself, because what
 * is drawn depends on which lines are on screen as well as on the passages.
 */
export function workedBrackets(
  field: StateField<RangeSet<WorkedMark>>,
  highlights: StateField<DecorationSet>,
): Extension {
  function build(view: EditorView): DecorationSet {
    const sources = bracketSources(view.state, field, highlights);
    if (sources.length === 0) return Decoration.none;

    const activeId = view.state.field(activeWorkedField, false) ?? null;
    const marks: Range<Decoration>[] = [];
    for (const { from, to } of view.visibleRanges) {
      for (const line of bracketLines(view.state.doc, sources, from, to, activeId)) {
        const classes = ["cm-worked"];
        if (line.first) classes.push("cm-worked-first");
        if (line.last) classes.push("cm-worked-last");
        if (line.active) classes.push("cm-worked-active");
        const attributes: Record<string, string> = { [WORKED_LINE_ATTR]: line.id };
        // Handed to the CSS rather than painted on directly, so the colour
        // only shows where the clicked-bracket rule below asks for it.
        if (line.color) attributes.style = `--worked-color: ${line.color}`;
        marks.push(Decoration.line({ class: classes.join(" "), attributes }).range(line.from));
      }
    }
    return Decoration.set(marks, true);
  }

  return [
    ViewPlugin.fromClass(
      class {
        decorations: DecorationSet;

        constructor(view: EditorView) {
          this.decorations = build(view);
        }

        update(update: {
          docChanged: boolean;
          viewportChanged: boolean;
          view: EditorView;
          startState: EditorView["state"];
          state: EditorView["state"];
        }) {
          const movedOrChanged =
            update.state.field(field) !== update.startState.field(field) ||
            update.state.field(highlights) !== update.startState.field(highlights) ||
            update.state.field(activeWorkedField, false) !==
              update.startState.field(activeWorkedField, false);
          if (update.docChanged || update.viewportChanged || movedOrChanged) {
            this.decorations = build(update.view);
          }
        }
      },
      { decorations: (plugin) => plugin.decorations },
    ),
    EditorView.theme({
      ".cm-worked": { position: "relative" },
      /**
       * Out in the margin beside the prose, not over it. The text column is
       * centred and narrower than the scroller, so there is already empty
       * space here to draw in at any window width.
       *
       * It takes clicks, unlike most things drawn over a page: the bracket is
       * the part of a reworked passage you can actually see from across the
       * page, so it should be the part you can aim at.
       */
      ".cm-worked::before": {
        content: '""',
        position: "absolute",
        left: "-1.15em",
        top: "0",
        bottom: "0",
        width: "0.4em",
        borderLeft: STROKE,
        opacity: "0.55",
        cursor: "pointer",
      },
      /**
       * No hover state. The bracket is drawn one piece per line, and the piece
       * reacts to the whole line of prose rather than to itself, so running
       * the mouse down a passage lit its segments one at a time and made a
       * tall bracket look broken up. Clicking is what colours a bracket, and
       * that needs no warming up to.
       */
      ".cm-worked-first::before": { borderTop: STROKE },
      ".cm-worked-last::before": { borderBottom: STROKE },
      /**
       * Click a bracket and it shows what its passage is marked as, which is
       * the one thing the margin cannot say on its own: out here it is a grey
       * line like every other, and the colour is over in the prose.
       *
       * A reworked passage has no mark left to show, so it falls back to the
       * accent: still clearly the one being worked on, making no claim about
       * what it is marked as.
       *
       * Drawn a touch wider as well, because a colour change alone is easy to
       * miss in a 2px line out at the edge of the page.
       *
       * The two arms are matched on both classes so they beat the plain grey
       * ones above however the rules come out in the stylesheet.
       */
      ".cm-worked-active::before": {
        borderLeftColor: ACTIVE_STROKE_COLOR,
        opacity: "1",
        width: "0.5em",
      },
      ".cm-worked-active.cm-worked-first::before": { borderTopColor: ACTIVE_STROKE_COLOR },
      ".cm-worked-active.cm-worked-last::before": { borderBottomColor: ACTIVE_STROKE_COLOR },
    }),
  ];
}
