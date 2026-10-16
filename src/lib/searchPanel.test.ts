import { describe, it, expect } from "vitest";
import { EditorState } from "@codemirror/state";
import { SearchQuery } from "@codemirror/search";
import { countMatches, describeMatches } from "./searchPanel";

const doc = (text: string) => EditorState.create({ doc: text });
const q = (search: string, caseSensitive = false) => new SearchQuery({ search, caseSensitive });

describe("counting matches", () => {
  const text = "Alice was tired. Alice was bored. The alice in question was tired.";

  it("counts every occurrence, ignoring case by default", () => {
    expect(countMatches(doc(text), q("Alice"), 0).total).toBe(3);
  });

  it("respects case when asked", () => {
    expect(countMatches(doc(text), q("Alice", true), 0).total).toBe(2);
  });

  it("says which match the cursor is inside", () => {
    const second = text.indexOf("Alice", 5) + 2;
    expect(countMatches(doc(text), q("Alice"), second).current).toBe(2);
  });

  it("reports no current match when the cursor is elsewhere", () => {
    expect(countMatches(doc(text), q("Alice"), 13).current).toBe(0);
  });

  it("finds nothing for a word that isn't there", () => {
    expect(countMatches(doc(text), q("Wonderland"), 0).total).toBe(0);
  });

  it("treats an empty query as nothing rather than everything", () => {
    expect(countMatches(doc(text), q(""), 0).total).toBe(0);
  });

  it("stops counting a very common word rather than scanning forever", () => {
    // A long chapter and a word like "the" shouldn't cost a full scan on
    // every keystroke.
    const many = "the ".repeat(5000);
    const counted = countMatches(doc(many), q("the"), 0);
    expect(counted.capped).toBe(true);
    expect(counted.total).toBeLessThanOrEqual(999);
  });
});

describe("what the panel says", () => {
  it("shows position and total when sitting on a match", () => {
    expect(describeMatches("Alice", { total: 12, current: 3, capped: false })).toBe("3 of 12");
  });

  it("shows just the total when the cursor is not on one", () => {
    expect(describeMatches("Alice", { total: 12, current: 0, capped: false })).toBe("12 found");
  });

  it("says so plainly when there is nothing", () => {
    expect(describeMatches("Wonderland", { total: 0, current: 0, capped: false })).toBe("no matches");
  });

  it("says nothing at all before anything is typed", () => {
    expect(describeMatches("", { total: 0, current: 0, capped: false })).toBe("");
  });

  it("marks a capped count so the number isn't a lie", () => {
    expect(describeMatches("the", { total: 999, current: 4, capped: true })).toBe("4 of 999+");
  });
});
