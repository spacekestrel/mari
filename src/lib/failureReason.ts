/**
 * The short version of whatever went wrong, fit to show a writer.
 *
 * Shared so every place that reports a failure says it the same way: the
 * status bar, and the sidebar when a folder won't open.
 */

/** Longer than this and it stops being a sentence and starts being a dump. */
const LIMIT = 90;

export function failureReason(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  // `String({})` gives "[object Object]", which tells the writer nothing —
  // better to show no reason than a fake one.
  const reason = raw.startsWith("[object ") ? "" : raw.trim();
  return reason.length > LIMIT ? `${reason.slice(0, LIMIT - 1)}…` : reason;
}

/**
 * Whether a failure means the folder simply isn't there any more.
 *
 * Writers reorganise their folders and Mari is left holding a path to
 * something that moved. That deserves a plain sentence rather than the
 * system's own words, so it has to be told apart from a real fault.
 *
 * Matched on the system's message because that is all that crosses back from
 * the file system. The wording differs per platform, so each one is listed:
 * Linux and macOS say "No such file or directory (os error 2)", Windows says
 * it cannot find the path, and a browser throws NotFoundError. The boundary
 * after `os error 2` matters — `os error 20` is "not a directory", which is a
 * different problem and must not be swallowed as a missing folder.
 */
const MISSING =
  /(no such file or directory|os error 2\b|cannot find the (path|file) specified|os error 3\b|enoent|notfounderror)/i;

export function isMissing(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (error instanceof Error && error.name === "NotFoundError") return true;
  return MISSING.test(raw);
}
