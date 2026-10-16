import type { MariPlanBeat } from "./mariBundle";

/**
 * The plan is edited as plain lines, one beat each, but stored as beats that
 * remember whether they're ticked off. Turning one into the other is where a
 * reworded beat could silently untick the rest, so it lives here rather than
 * inside the header component.
 */

/** The plan as text: one beat per line, for the editing box. */
export function beatsToLines(beats: MariPlanBeat[]): string {
  return beats.map((beat) => beat.text).join("\n");
}

/**
 * Rebuilds the plan from edited lines. Ticks carry across by matching text, so
 * rewording one beat leaves the others' ticks alone. Each old beat is claimed
 * at most once, so two identically worded beats can't both inherit the same
 * tick. Blank lines are dropped, so the sequence never has holes.
 */
export function mergePlanBeats(draft: string, existing: MariPlanBeat[]): MariPlanBeat[] {
  const lines = draft
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const unclaimed = [...existing];
  return lines.map((text) => {
    const at = unclaimed.findIndex((beat) => beat.text === text);
    if (at === -1) return { text };
    const [claimed] = unclaimed.splice(at, 1);
    return claimed;
  });
}

/**
 * Whether two plans are the same beats in the same order and state. Used so
 * opening the editing box and closing it again doesn't mark the file unsaved.
 */
export function samePlan(a: MariPlanBeat[], b: MariPlanBeat[]): boolean {
  return (
    a.length === b.length &&
    a.every((beat, i) => beat.text === b[i].text && beat.done === b[i].done)
  );
}
