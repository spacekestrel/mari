/**
 * Applying and removing Markdown emphasis around a selection.
 *
 * Kept away from the editor so the awkward parts are testable on plain
 * strings: telling `*italic*` from the `*` inside `**bold**`, and the fact
 * that `**word **` doesn't render as bold, so a selection ending in a space
 * has to put the marker inside it.
 *
 * Every function takes the document text and a range, and returns a single
 * replacement plus where the selection should end up. Nothing here knows
 * about CodeMirror.
 */

export type Inline = "bold" | "italic" | "strike";
export type Block = "heading1" | "heading2" | "quote";

const MARKER: Record<Inline, string> = { bold: "**", italic: "*", strike: "~~" };
const PREFIX: Record<Block, string> = { heading1: "# ", heading2: "## ", quote: "> " };

/** A whole-document replacement, and the selection to leave behind. */
export interface Edit {
  from: number;
  to: number;
  insert: string;
  /** Where the selection should sit afterwards, as absolute offsets. */
  selectFrom: number;
  selectTo: number;
}

/**
 * How many `*` sit immediately around the range, counting outwards.
 *
 * Bold and italic share a character, so neither can be recognised by looking
 * for its own marker: `***word***` is both at once. Only the size of the run
 * distinguishes them. One asterisk is italic, two is bold, three is both,
 * which is why this counts rather than string-matching. Capped at three
 * because nothing standard means anything beyond that.
 */
function starRun(text: string, from: number, to: number): number {
  let before = 0;
  while (before < 3 && text[from - 1 - before] === "*") before++;
  let after = 0;
  while (after < 3 && text[to + after] === "*") after++;
  return Math.min(before, after);
}

/** The same count, for markers the writer happened to select along with the text. */
function innerStarRun(inner: string): number {
  let lead = 0;
  while (lead < 3 && inner[lead] === "*") lead++;
  let tail = 0;
  while (tail < 3 && inner[inner.length - 1 - tail] === "*") tail++;
  const n = Math.min(lead, tail);
  // `**` alone isn't a wrapped word, it's an empty pair.
  return inner.length > n * 2 ? n : 0;
}

function activeForRun(run: number, kind: Inline): boolean {
  if (kind === "italic") return run === 1 || run === 3;
  return run >= 2; // bold
}

/** Whether the selection already carries this emphasis, either way round. */
export function isInlineActive(text: string, from: number, to: number, kind: Inline): boolean {
  if (from === to) return false;
  if (kind === "strike") {
    const inner = text.slice(from, to);
    return (
      (text.slice(from - 2, from) === "~~" && text.slice(to, to + 2) === "~~") ||
      (inner.length > 4 && inner.startsWith("~~") && inner.endsWith("~~"))
    );
  }
  return (
    activeForRun(starRun(text, from, to), kind) ||
    activeForRun(innerStarRun(text.slice(from, to)), kind)
  );
}

/**
 * Adds the emphasis, or takes it off when it's already there.
 *
 * Returns null for an empty selection: there is nothing to wrap, and
 * inserting bare markers for the writer to type between is a different
 * feature with its own cursor problems.
 */
export function toggleInline(text: string, from: number, to: number, kind: Inline): Edit | null {
  if (from === to) return null;
  const m = MARKER[kind];

  // Taking emphasis off removes exactly this marker's worth of characters,
  // so italic on `***word***` leaves `**word**` rather than stripping the lot.
  if (isInlineActive(text, from, to, kind)) {
    const outside =
      kind === "strike"
        ? text.slice(from - 2, from) === "~~"
        : starRun(text, from, to) >= m.length;

    if (outside) {
      const inner = text.slice(from, to);
      return {
        from: from - m.length,
        to: to + m.length,
        insert: inner,
        selectFrom: from - m.length,
        selectTo: from - m.length + inner.length,
      };
    }
    // The markers were inside the selection, so trim them off both ends.
    const inner = text.slice(from + m.length, to - m.length);
    return { from, to, insert: inner, selectFrom: from, selectTo: from + inner.length };
  }

  // `**word **` renders as literal asterisks, so padding goes outside.
  const selected = text.slice(from, to);
  const lead = selected.match(/^\s*/)![0];
  const tail = selected.match(/\s*$/)![0];
  const core = selected.slice(lead.length, selected.length - tail.length);
  if (!core) return null;

  const insert = `${lead}${m}${core}${m}${tail}`;
  return {
    from,
    to,
    insert,
    selectFrom: from + lead.length + m.length,
    selectTo: from + lead.length + m.length + core.length,
  };
}

/** The line containing `at`, as absolute offsets. */
function lineAt(text: string, at: number): { from: number; to: number } {
  const from = text.lastIndexOf("\n", Math.max(0, at - 1)) + 1;
  const nl = text.indexOf("\n", at);
  return { from, to: nl < 0 ? text.length : nl };
}

/** What heading or quote prefix a line already carries, if any. */
function prefixOf(line: string): { block: Block; length: number } | null {
  const m = line.match(/^(#{1,2} |> )/);
  if (!m) return null;
  const found = m[1];
  const block = (Object.keys(PREFIX) as Block[]).find((b) => PREFIX[b] === found);
  return block ? { block, length: found.length } : null;
}

export function isBlockActive(text: string, at: number, kind: Block): boolean {
  const { from, to } = lineAt(text, at);
  return prefixOf(text.slice(from, to))?.block === kind;
}

/**
 * Keeps an offset on the same character after a line's prefix grew or shrank.
 *
 * The prefix is inserted at the start of the line, so an offset sitting there
 * moves along with the text rather than staying put in front of the new
 * marker. Clamped so removing a prefix can't push it onto the line above.
 */
function shifted(at: number, lineFrom: number, by: number): number {
  return Math.max(lineFrom, at + by);
}

/**
 * Puts a heading or quote marker on the line, takes it off when it's already
 * that, or swaps it when the line is currently something else.
 *
 * Works on the line rather than the selection because that's what these are
 * in Markdown: you cannot make half a line a heading.
 */
export function toggleBlock(text: string, at: number, kind: Block, until = at): Edit {
  const { from, to } = lineAt(text, at);
  const line = text.slice(from, to);
  const existing = prefixOf(line);
  const bare = existing ? line.slice(existing.length) : line;
  const insert = existing?.block === kind ? bare : PREFIX[kind] + bare;
  const shift = insert.length - line.length;

  return {
    from,
    to,
    insert,
    // The same words stay selected, moved along by however much the prefix
    // grew or shrank. Collapsing to a caret here would close the toolbar the
    // writer just used, so pressing the button a second time would be
    // impossible without reselecting.
    selectFrom: shifted(at, from, shift),
    selectTo: shifted(until, from, shift),
  };
}
