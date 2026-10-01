/**
 * Saying "Loading…" only when there is really something to wait for.
 *
 * Reading a folder off a local disk usually takes a few milliseconds. Showing
 * the word for those few milliseconds and taking it away again is a flicker,
 * not information, and it is at its worst on an empty folder where the word is
 * the only thing on screen and is replaced by nothing at all.
 */

/**
 * Long enough that a local read is over before it fires, short enough that a
 * slow one is admitted to before the writer wonders.
 */
export const SLOW_AFTER_MS = 150;

/**
 * Runs `say` only if whatever is happening is still happening after a moment.
 * Returns a function to call when it finishes, which cancels the message if it
 * hasn't appeared yet.
 */
export function announceIfSlow(say: () => void, after = SLOW_AFTER_MS): () => void {
  const timer = setTimeout(say, after);
  return () => clearTimeout(timer);
}
