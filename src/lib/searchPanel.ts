import { EditorView, type Panel } from "@codemirror/view";
import {
  search,
  searchKeymap,
  setSearchQuery,
  getSearchQuery,
  findNext,
  findPrevious,
  closeSearchPanel,
  openSearchPanel,
  SearchQuery,
  SearchCursor,
} from "@codemirror/search";
import { keymap } from "@codemirror/view";
import type { EditorState, Extension } from "@codemirror/state";

/**
 * Finding a word in the chapter.
 *
 * CodeMirror ships a search panel, but it is a code editor's: regular
 * expressions, whole-word toggles, replace-all. A novelist wants to know where
 * they used a word and how many times. This is that panel, in Mari's own
 * surface colours, with the count front and centre.
 */

/** How many matches to bother counting before saying "lots". */
const COUNT_LIMIT = 999;

/**
 * Matches in the document, and which one the cursor is sitting on.
 *
 * Counting stops at the limit so a common word in a long chapter doesn't cost
 * a full scan on every keystroke.
 */
export function countMatches(
  state: EditorState,
  query: SearchQuery,
  at: number,
): { total: number; current: number; capped: boolean } {
  if (!query.valid) return { total: 0, current: 0, capped: false };

  let total = 0;
  let current = 0;
  const cursor = new SearchCursor(
    state.doc,
    query.search,
    0,
    state.doc.length,
    query.caseSensitive ? undefined : (x) => x.toLowerCase(),
  );

  while (!cursor.next().done) {
    total++;
    if (cursor.value.from <= at && at <= cursor.value.to) current = total;
    if (total >= COUNT_LIMIT) return { total, current, capped: true };
  }
  return { total, current, capped: false };
}

/** "3 of 12", or something honest when there's nothing to say. */
export function describeMatches(
  query: string,
  counts: { total: number; current: number; capped: boolean },
): string {
  if (!query) return "";
  if (counts.total === 0) return "no matches";
  const total = counts.capped ? `${counts.total}+` : `${counts.total}`;
  return counts.current ? `${counts.current} of ${total}` : `${total} found`;
}

function button(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const b = document.createElement("button");
  b.className = "mari-search-btn";
  b.type = "button";
  b.textContent = label;
  b.title = title;
  b.setAttribute("aria-label", title);
  b.onclick = onClick;
  return b;
}

function createPanel(view: EditorView): Panel {
  const dom = document.createElement("div");
  dom.className = "mari-search";
  // Stops a click in the panel being read as a click in the prose, which
  // would move the cursor out from under the match being stepped through.
  dom.onmousedown = (e) => {
    if (e.target !== input) e.preventDefault();
  };

  const input = document.createElement("input");
  input.className = "mari-search-input";
  input.placeholder = "Find in chapter";
  input.setAttribute("main-field", "true");
  input.value = getSearchQuery(view.state).search;

  const count = document.createElement("span");
  count.className = "mari-search-count";

  const refresh = () => {
    const query = getSearchQuery(view.state);
    count.textContent = describeMatches(
      query.search,
      countMatches(view.state, query, view.state.selection.main.from),
    );
  };

  const apply = () => {
    view.dispatch({
      effects: setSearchQuery.of(
        new SearchQuery({ search: input.value, caseSensitive: false, regexp: false }),
      ),
    });
    refresh();
  };

  input.oninput = apply;
  input.onkeydown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      (e.shiftKey ? findPrevious : findNext)(view);
      refresh();
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearchPanel(view);
      view.focus();
    }
  };

  dom.append(
    input,
    count,
    button("↑", "Previous match", () => {
      findPrevious(view);
      refresh();
    }),
    button("↓", "Next match", () => {
      findNext(view);
      refresh();
    }),
    button("✕", "Close search", () => {
      closeSearchPanel(view);
      view.focus();
    }),
  );

  return {
    dom,
    top: true,
    mount: refresh,
    update: (update) => {
      if (update.docChanged || update.selectionSet) refresh();
    },
  };
}

/**
 * Search, on Ctrl+F.
 *
 * The binding is matched on the physical key rather than the character it
 * produces, so it still works when the keyboard is switched to a layout where
 * that key isn't "f".
 */
export function findInChapter(): Extension {
  return [
    search({ top: true, createPanel }),
    keymap.of(searchKeymap),
    EditorView.domEventHandlers({
      keydown: (event, view) => {
        if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return false;
        if (event.code !== "KeyF") return false;
        event.preventDefault();
        openSearchPanel(view);
        return true;
      },
    }),
    EditorView.theme({
      ".mari-search": {
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "6px 10px",
        borderBottom: "1px solid var(--color-border)",
        background: "var(--color-surface)",
        fontFamily: "var(--font-ui)",
      },
      ".mari-search-input": {
        flex: "1",
        minWidth: "0",
        padding: "5px 8px",
        border: "1px solid var(--color-border)",
        borderRadius: "6px",
        background: "var(--color-bg)",
        color: "var(--color-text)",
        font: "inherit",
        fontSize: "0.85rem",
      },
      ".mari-search-input:focus": {
        outline: "none",
        borderColor: "var(--color-accent)",
      },
      ".mari-search-count": {
        flexShrink: "0",
        minWidth: "72px",
        textAlign: "right",
        fontSize: "0.78rem",
        color: "var(--color-text-muted)",
      },
      ".mari-search-btn": {
        flexShrink: "0",
        width: "26px",
        height: "26px",
        padding: "0",
        border: "none",
        borderRadius: "6px",
        background: "transparent",
        color: "var(--color-text)",
        cursor: "pointer",
        fontSize: "0.8rem",
        lineHeight: "1",
      },
      ".mari-search-btn:hover": {
        background: "var(--color-hover)",
      },
    }),
  ];
}
