import { describe, expect, it } from "vitest";
import { sampleChapter } from "./sampleChapter";
import { HIGHLIGHT_STATES } from "./highlightStates";

const LOCALES = ["en", "ru"] as const;

/** The chapter's paragraphs, as the spans they occupy in the text. */
function paragraphs(text: string): { from: number; to: number }[] {
  const spans: { from: number; to: number }[] = [];
  let at = 0;
  for (const part of text.split("\n\n")) {
    if (part.trim()) spans.push({ from: at, to: at + part.length });
    at += part.length + 2;
  }
  return spans;
}

describe.each(LOCALES)("sample chapter (%s)", (locale) => {
  const sample = sampleChapter(locale);

  it("is a chapter's worth of prose, not a snippet", () => {
    expect(sample.text.length).toBeGreaterThan(5000);
    expect(paragraphs(sample.text).length).toBeGreaterThan(20);
  });

  it("lets paragraphs run on, rather than breaking them by hand", () => {
    // The source was hard-wrapped at about seventy characters. Those breaks
    // are real characters, and they stop every line short of the column —
    // which reads as a chapter set too narrow, with a centred heading pushed
    // off to one side.
    const hardWrapped = sample.text.split("\n\n").filter((p) => p.includes("\n"));
    expect(hardWrapped).toEqual([]);
  });

  it("marks whole paragraphs and never part of one", () => {
    // The states are meant for passages, not clauses. A sample that marked
    // half a sentence would teach the wrong habit at first glance.
    const spans = paragraphs(sample.text);
    for (const h of sample.highlights) {
      const exact = spans.some((p) => p.from === h.from && p.to === h.to);
      expect(exact, `mark ${h.stateId} at ${h.from}-${h.to} is not a whole paragraph`).toBe(true);
    }
  });

  it("shows every state the app has", () => {
    const marked = new Set(sample.highlights.map((h) => h.stateId));
    for (const state of HIGHLIGHT_STATES) {
      expect(marked, `nothing marked ${state.id}`).toContain(state.id);
    }
  });

  it("never marks the same paragraph twice", () => {
    const starts = sample.highlights.map((h) => h.from);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it("gives every mark its own identity", () => {
    const ids = sample.highlights.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("attaches notes and kept drafts to marks that exist", () => {
    const ids = new Set(sample.highlights.map((h) => h.id));
    for (const id of Object.keys(sample.notes)) expect(ids).toContain(id);
    for (const id of Object.keys(sample.history)) expect(ids).toContain(id);
    expect(Object.keys(sample.notes).length).toBeGreaterThanOrEqual(5);
    expect(Object.keys(sample.history).length).toBeGreaterThanOrEqual(1);
  });

  it("carries a synopsis and a plan, partly ticked off", () => {
    expect(sample.synopsis.text).not.toBe("");
    expect(sample.synopsis.plan.length).toBeGreaterThanOrEqual(4);
    for (const beat of sample.synopsis.plan) expect(beat.text).not.toBe("");
    expect(sample.synopsis.plan.some((b) => b.done)).toBe(true);
    expect(sample.synopsis.plan.some((b) => !b.done)).toBe(true);
  });

  it("has passages in the drawer that are no longer in the prose", () => {
    expect(sample.cuts.length).toBeGreaterThanOrEqual(2);
    for (const cut of sample.cuts) {
      expect(cut.text).not.toBe("");
      // A drawer passage is one taken *out*. Finding it still in the chapter
      // would contradict what the drawer is for.
      expect(sample.text).not.toContain(cut.text);
      expect(cut.note).toBeTruthy();
    }
  });

  it("opens the same way every time", () => {
    expect(sampleChapter(locale)).toEqual(sample);
  });
});

describe("sample chapter", () => {
  it("says the same things about the chapter in each language", () => {
    const en = sampleChapter("en");
    const ru = sampleChapter("ru");
    // The prose is the same English novel either way; what changes is
    // everything the writer wrote about it.
    expect(ru.text).toBe(en.text);
    expect(ru.synopsis.text).not.toBe(en.synopsis.text);
    expect(Object.keys(ru.notes)).toEqual(Object.keys(en.notes));
    for (const id of Object.keys(en.notes)) expect(ru.notes[id]).not.toBe(en.notes[id]);
    for (const cut of ru.cuts) {
      expect(cut.note).not.toBe(en.cuts.find((c) => c.id === cut.id)?.note);
    }
  });
});
