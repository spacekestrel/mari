import { describe, expect, it } from "vitest";
import { sampleChapter } from "./sampleChapter";
import { HIGHLIGHT_STATES } from "./highlightStates";

const LOCALES = ["en", "ru"] as const;

describe.each(LOCALES)("sample chapter (%s)", (locale) => {
  const sample = sampleChapter(locale);

  it("has prose and a name", () => {
    expect(sample.text.trim().length).toBeGreaterThan(200);
    expect(sample.fileName.endsWith(".mari")).toBe(true);
  });

  it("marks passages that are actually in the prose", () => {
    // The marks are located by their words. A phrase that has been edited in
    // the text but not in the mark would silently vanish from the sample.
    expect(sample.highlights.length).toBe(6);
    for (const h of sample.highlights) {
      expect(h.to).toBeGreaterThan(h.from);
      expect(h.to).toBeLessThanOrEqual(sample.text.length);
    }
  });

  it("marks each phrase in only one place", () => {
    for (const h of sample.highlights) {
      const phrase = sample.text.slice(h.from, h.to);
      expect(sample.text.indexOf(phrase)).toBe(sample.text.lastIndexOf(phrase));
    }
  });

  it("uses states the app actually has", () => {
    const known = new Set(HIGHLIGHT_STATES.map((s) => s.id));
    for (const h of sample.highlights) expect(known).toContain(h.stateId);
  });

  it("shows more than one kind of mark", () => {
    // The point of the sample is the range of them.
    expect(new Set(sample.highlights.map((h) => h.stateId)).size).toBeGreaterThanOrEqual(4);
  });

  it("gives every mark its own identity", () => {
    const ids = sample.highlights.map((h) => h.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("attaches notes and kept drafts to marks that exist", () => {
    const ids = new Set(sample.highlights.map((h) => h.id));
    for (const id of Object.keys(sample.notes)) expect(ids).toContain(id);
    for (const id of Object.keys(sample.history)) expect(ids).toContain(id);
    expect(Object.keys(sample.notes).length).toBeGreaterThanOrEqual(3);
    expect(Object.keys(sample.history).length).toBeGreaterThanOrEqual(1);
  });

  it("carries a synopsis and a plan", () => {
    expect(sample.synopsis.text).not.toBe("");
    expect(sample.synopsis.plan.length).toBeGreaterThanOrEqual(3);
    for (const beat of sample.synopsis.plan) expect(beat.text).not.toBe("");
  });

  it("has something in the drawer that is no longer in the prose", () => {
    expect(sample.cuts).toHaveLength(1);
    const cut = sample.cuts[0];
    expect(cut.text).not.toBe("");
    // A drawer passage is one taken *out* of the chapter. Finding it still in
    // the prose would mean the sample contradicts what the drawer is for.
    expect(sample.text).not.toContain(cut.text);
    expect(cut.note).toBeTruthy();
  });

  it("opens the same way every time", () => {
    expect(sampleChapter(locale)).toEqual(sample);
  });
});

describe("sample chapter", () => {
  it("is a different chapter in each language, not the same one", () => {
    expect(sampleChapter("ru").text).not.toBe(sampleChapter("en").text);
    expect(sampleChapter("ru").fileName).not.toBe(sampleChapter("en").fileName);
  });
});
