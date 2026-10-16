import { describe, expect, it } from "vitest";
import { beatsToLines, mergePlanBeats, samePlan } from "./plan";
import type { MariPlanBeat } from "./mariBundle";

/**
 * Editing the plan rebuilds every beat from the text in the box, so this is
 * where a reworded beat could silently untick the rest.
 */

const plan: MariPlanBeat[] = [
  { text: "Mark takes the job", done: true },
  { text: "Julian shows up" },
  { text: "They split the run", done: true },
];

describe("editing the plan", () => {
  it("shows one beat per line in the box", () => {
    expect(beatsToLines(plan)).toBe("Mark takes the job\nJulian shows up\nThey split the run");
  });

  it("leaves the plan alone when nothing was typed", () => {
    const next = mergePlanBeats(beatsToLines(plan), plan);
    expect(next).toEqual(plan);
    expect(samePlan(next, plan)).toBe(true);
  });

  it("keeps the other ticks when one beat is reworded", () => {
    const next = mergePlanBeats("Mark takes the job\nJulian shows up on the pier\nThey split the run", plan);
    expect(next.map((b) => b.done)).toEqual([true, undefined, true]);
    expect(next[1].text).toBe("Julian shows up on the pier");
  });

  it("keeps ticks when beats are reordered", () => {
    const next = mergePlanBeats("They split the run\nMark takes the job\nJulian shows up", plan);
    expect(next.map((b) => `${b.text}:${b.done ? "done" : "todo"}`)).toEqual([
      "They split the run:done",
      "Mark takes the job:done",
      "Julian shows up:todo",
    ]);
  });

  it("keeps the ticks on beats that survive a deletion", () => {
    const next = mergePlanBeats("They split the run", plan);
    expect(next).toEqual([{ text: "They split the run", done: true }]);
  });

  it("adds new beats unticked", () => {
    const next = mergePlanBeats(`${beatsToLines(plan)}\nThe ferry turns back`, plan);
    expect(next).toHaveLength(4);
    expect(next[3]).toEqual({ text: "The ferry turns back" });
  });

  it("does not let two identical beats share one tick", () => {
    const twins: MariPlanBeat[] = [{ text: "Same wording", done: true }, { text: "Same wording" }];
    const next = mergePlanBeats("Same wording\nSame wording", twins);
    // Exactly one tick between them, as before — not both, not neither.
    expect(next.filter((b) => b.done)).toHaveLength(1);
  });

  it("drops blank lines so the sequence has no holes", () => {
    const next = mergePlanBeats("  First  \n\n\n   \nSecond\n", []);
    expect(next).toEqual([{ text: "First" }, { text: "Second" }]);
  });

  it("empties the plan when the box is cleared", () => {
    expect(mergePlanBeats("   \n\n", plan)).toEqual([]);
  });
});

describe("noticing a real change", () => {
  it("sees a reworded beat", () => {
    expect(samePlan(plan, mergePlanBeats("Mark takes the job\nJulian arrives\nThey split the run", plan))).toBe(false);
  });

  it("sees a tick change", () => {
    const ticked = plan.map((b, i) => (i === 1 ? { ...b, done: true } : b));
    expect(samePlan(plan, ticked)).toBe(false);
  });

  it("sees a reorder", () => {
    expect(samePlan(plan, [plan[1], plan[0], plan[2]])).toBe(false);
  });

  it("sees a removal", () => {
    expect(samePlan(plan, plan.slice(0, 2))).toBe(false);
  });
});
