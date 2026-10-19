import { describe, expect, it } from "vitest";
import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import { emptySynopsis, packMariBundle, unpackMariBundle, type MariCut } from "./mariBundle";

/**
 * A cut passage exists in exactly one place: the `.mari` file. It isn't in the
 * prose any more, and the clipboard forgot it long ago. So these tests are
 * about one thing — no future change to this app may quietly drop it.
 */

const cut = (over: Partial<MariCut> = {}): MariCut => ({
  id: "cut-1",
  text: "The passage that was taken out.",
  cutAt: "2026-08-26T10:00:00.000Z",
  ...over,
});

/** A full bundle, so a dropped part shows up as a diff rather than a silence. */
function fullBundle(cuts: MariCut[] = [cut()]) {
  return {
    text: "Chapter prose.\n\nSecond paragraph.\n",
    highlights: [{ from: 0, to: 14, stateId: "good", id: "mark-1" }],
    notes: { "mark-1": "a note" },
    history: {
      "mark-1": [{ id: "v1", text: "older wording", createdAt: "2026-08-01T00:00:00.000Z", kind: "draft" as const }],
    },
    synopsis: { text: "What happens.", plan: [{ text: "First beat" }, { text: "Second beat", done: true }] },
    cuts,
    worked: [{ id: "mark-1", from: 0, to: 14 }],
  } as Parameters<typeof packMariBundle>[0];
}

const roundTrip = (b: Parameters<typeof packMariBundle>[0]) => unpackMariBundle(packMariBundle(b));

describe("cuts survive a save", () => {
  it("keeps a cut's text, id and timestamp", () => {
    expect(roundTrip(fullBundle()).cuts).toEqual([cut()]);
  });

  it("keeps every cut when there are several", () => {
    const many = [cut({ id: "a" }), cut({ id: "b", text: "another" }), cut({ id: "c", text: "third" })];
    expect(roundTrip(fullBundle(many)).cuts.map((c) => c.id)).toEqual(["a", "b", "c"]);
  });

  it("keeps the words exactly, including ones that break naive encoders", () => {
    const awkward = '"Quotes", \\backslashes, \nnewlines, кириллица, emoji, </script>';
    expect(roundTrip(fullBundle([cut({ text: awkward })])).cuts[0].text).toBe(awkward);
  });

  it("keeps a cut through repeated saves", () => {
    let back = roundTrip(fullBundle());
    for (let i = 0; i < 5; i++) back = roundTrip(back);
    expect(back.cuts).toEqual([cut()]);
  });

  it("does not let cuts disturb the rest of the file", () => {
    const back = roundTrip(fullBundle());
    expect(back.text).toBe("Chapter prose.\n\nSecond paragraph.\n");
    expect(back.highlights).toHaveLength(1);
    expect(back.notes).toEqual({ "mark-1": "a note" });
    expect(Object.keys(back.history)).toEqual(["mark-1"]);
    expect(back.synopsis.plan).toEqual([{ text: "First beat", done: false }, { text: "Second beat", done: true }]);
  });
});

describe("cuts survive files this build didn't write", () => {
  it("reads a file saved before cuts existed without inventing or losing anything", () => {
    const stripped = unzipSync(packMariBundle(fullBundle([])));
    delete stripped["cuts.json"];
    const back = unpackMariBundle(zipSync(stripped));
    expect(back.cuts).toEqual([]);
    expect(back.text).toContain("Chapter prose");
  });

  it("carries parts from a newer build through a save, alongside the cuts", () => {
    const withExtra = unzipSync(packMariBundle(fullBundle()));
    withExtra["characters.json"] = strToU8('[{"name":"Julian"}]');
    const opened = unpackMariBundle(zipSync(withExtra));
    const resaved = unzipSync(packMariBundle(opened));
    expect(strFromU8(resaved["characters.json"])).toBe('[{"name":"Julian"}]');
    expect(unpackMariBundle(zipSync(resaved)).cuts).toEqual([cut()]);
  });

  it("never stamps a newer file's version back down", () => {
    const opened = unpackMariBundle(
      packMariBundle({ ...fullBundle(), manifest: { format: "mari", version: 9 } }),
    );
    const back = unpackMariBundle(packMariBundle(opened));
    expect(back.manifest.version).toBe(9);
    expect(back.cuts).toEqual([cut()]);
  });
});

/**
 * A bracket in the margin is the only sign left that a passage was reworked —
 * the highlight that asked for the rewrite is cleared when the work is done.
 * Lose the brackets and the earlier wordings are still in the file with nothing
 * pointing at them.
 */
describe("brackets survive a save", () => {
  it("keeps where a reworked passage sits", () => {
    expect(roundTrip(fullBundle()).worked).toEqual([{ id: "mark-1", from: 0, to: 14 }]);
  });

  it("keeps them through repeated saves", () => {
    let back = roundTrip(fullBundle());
    for (let i = 0; i < 5; i++) back = roundTrip(back);
    expect(back.worked).toEqual([{ id: "mark-1", from: 0, to: 14 }]);
  });

  it("keeps the chunk id, which is what leads back to the old wordings", () => {
    const back = roundTrip(fullBundle());
    expect(back.worked[0].id).toBe("mark-1");
    expect(Object.keys(back.history)).toContain(back.worked[0].id);
  });

  it("reads a file saved before brackets existed without inventing any", () => {
    const stripped = unzipSync(packMariBundle(fullBundle()));
    delete stripped["worked.json"];
    const back = unpackMariBundle(zipSync(stripped));
    expect(back.worked).toEqual([]);
    expect(back.cuts).toEqual([cut()]);
  });

  it("drops a mangled bracket rather than standing it against the wrong prose", () => {
    const damaged = unzipSync(packMariBundle(fullBundle()));
    damaged["worked.json"] = strToU8(
      '[{"id":"ok","from":0,"to":5},{"id":"","from":0,"to":5},{"from":0,"to":5},{"id":"backwards","from":9,"to":2},{"id":"empty","from":3,"to":3}]',
    );
    const back = unpackMariBundle(zipSync(damaged));
    expect(back.worked).toEqual([{ id: "ok", from: 0, to: 5 }]);
  });

  it("survives a brackets part that isn't a list", () => {
    const damaged = unzipSync(packMariBundle(fullBundle()));
    damaged["worked.json"] = strToU8('{"not":"a list"}');
    const back = unpackMariBundle(zipSync(damaged));
    expect(back.worked).toEqual([]);
    expect(back.text).toContain("Chapter prose");
  });
});

describe("a damaged file still gives back what it can", () => {
  it("drops only the broken part, never the cuts", () => {
    const files = unzipSync(packMariBundle(fullBundle()));
    files["highlights.json"] = strToU8("{ not json");
    files["synopsis.json"] = strToU8("also not json");
    const back = unpackMariBundle(zipSync(files));
    expect(back.cuts).toEqual([cut()]);
    expect(back.text).toContain("Chapter prose");
  });

  it("survives a cuts part that isn't a list", () => {
    const files = unzipSync(packMariBundle(fullBundle()));
    files["cuts.json"] = strToU8('"not an array"');
    const back = unpackMariBundle(zipSync(files));
    expect(back.cuts).toEqual([]);
    expect(back.text).toContain("Chapter prose");
  });

  it("keeps the salvageable entries when some are mangled", () => {
    const files = unzipSync(packMariBundle(fullBundle()));
    files["cuts.json"] = strToU8(JSON.stringify([{ text: "keep me" }, null, { nope: 1 }, { text: 42 }]));
    const back = unpackMariBundle(zipSync(files));
    expect(back.cuts.map((c) => c.text)).toEqual(["keep me"]);
    expect(back.cuts[0].id).toBeTruthy();
  });
});

describe("plan beats", () => {
  it("reads beats written before they could be ticked off", () => {
    const files = unzipSync(packMariBundle(fullBundle()));
    files["synopsis.json"] = strToU8(JSON.stringify({ text: "x", plan: ["old one", "old two"] }));
    const back = unpackMariBundle(zipSync(files));
    expect(back.synopsis.plan).toEqual([{ text: "old one" }, { text: "old two" }]);
  });

  it("keeps which beats are ticked across a save", () => {
    const back = roundTrip(fullBundle());
    expect(back.synopsis.plan.map((b) => b.done)).toEqual([false, true]);
  });

  it("drops beats that are neither a string nor have text", () => {
    const files = unzipSync(packMariBundle(fullBundle()));
    files["synopsis.json"] = strToU8(
      JSON.stringify({ text: "x", plan: ["keep", null, 42, { done: true }, { text: "also keep" }] }),
    );
    expect(unpackMariBundle(zipSync(files)).synopsis.plan.map((b) => b.text)).toEqual([
      "keep",
      "also keep",
    ]);
  });
});

describe("blank chapters don't share state", () => {
  it("gives each new chapter its own plan array", () => {
    emptySynopsis().plan.push({ text: "only mine" });
    expect(emptySynopsis().plan).toEqual([]);
  });
});
