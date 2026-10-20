import { beforeEach, describe, expect, it } from "vitest";
import { expandedFolders } from "./expandedFolders.svelte";

/**
 * Which folders are open is remembered across every project ever opened, in
 * one list. So the thing worth pinning down is the scoping: shutting one tree
 * must leave the others exactly as they were, or switching back to yesterday's
 * project would find it collapsed for no reason the writer can see.
 */

const PROJECT = "/home/writer/novel";
const OTHER = "/home/writer/stories";

/** Closes everything, so each test starts from a known tree. */
beforeEach(() => {
  expandedFolders.collapseAll(PROJECT);
  expandedFolders.collapseAll(OTHER);
});

describe("closing a whole project", () => {
  it("closes every folder in it, however deep", () => {
    expandedFolders.set(`${PROJECT}/part one`, true);
    expandedFolders.set(`${PROJECT}/part one/chapters`, true);
    expandedFolders.set(`${PROJECT}/notes`, true);

    expandedFolders.collapseAll(PROJECT);

    expect(expandedFolders.isExpanded(`${PROJECT}/part one`)).toBe(false);
    expect(expandedFolders.isExpanded(`${PROJECT}/part one/chapters`)).toBe(false);
    expect(expandedFolders.isExpanded(`${PROJECT}/notes`)).toBe(false);
  });

  it("leaves another project's folders open", () => {
    expandedFolders.set(`${PROJECT}/part one`, true);
    expandedFolders.set(`${OTHER}/drafts`, true);

    expandedFolders.collapseAll(PROJECT);

    expect(expandedFolders.isExpanded(`${OTHER}/drafts`)).toBe(true);
  });

  it("does not touch a project whose path merely starts the same way", () => {
    // "/home/writer/novel-old" begins with the other name but is not inside it.
    expandedFolders.set(`${PROJECT}-old/part one`, true);

    expandedFolders.collapseAll(PROJECT);

    expect(expandedFolders.isExpanded(`${PROJECT}-old/part one`)).toBe(true);
  });

  it("copes with a root path handed over with a trailing slash", () => {
    expandedFolders.set(`${PROJECT}/part one`, true);
    expandedFolders.collapseAll(`${PROJECT}/`);
    expect(expandedFolders.isExpanded(`${PROJECT}/part one`)).toBe(false);
  });

  it("does nothing when the tree is already shut", () => {
    expandedFolders.collapseAll(PROJECT);
    expect(expandedFolders.hasExpanded(PROJECT)).toBe(false);
  });
});

describe("knowing whether there is anything to close", () => {
  it("says no for a tree with nothing open", () => {
    expect(expandedFolders.hasExpanded(PROJECT)).toBe(false);
  });

  it("says yes once a folder is opened", () => {
    expandedFolders.set(`${PROJECT}/part one`, true);
    expect(expandedFolders.hasExpanded(PROJECT)).toBe(true);
  });

  it("says no again once that folder is closed by hand", () => {
    expandedFolders.set(`${PROJECT}/part one`, true);
    expandedFolders.set(`${PROJECT}/part one`, false);
    expect(expandedFolders.hasExpanded(PROJECT)).toBe(false);
  });

  it("is not fooled by another project being open", () => {
    expandedFolders.set(`${OTHER}/drafts`, true);
    expect(expandedFolders.hasExpanded(PROJECT)).toBe(false);
  });
});
