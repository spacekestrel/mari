import { unzipSync, zipSync, strToU8, strFromU8 } from "fflate";
import type { StoredHighlight } from "./highlightStore";
import type { ChunkVersion } from "./chunkHistory";

/**
 * A `.mari` file is a zip. Nothing is encrypted or obfuscated: rename it to
 * `.zip`, open it, and `content.md` is your prose in plain Markdown. That's
 * deliberate — the extras are worth having, but they must never be able to
 * hold a manuscript hostage.
 *
 * Layout:
 *
 *   manifest.json      format version + which parts are present
 *   content.md         the prose, plain Markdown
 *   highlights.json    revision marks
 *   notes.json         per-passage notes
 *   history.json       replaced drafts and moves
 *   synopsis.json      what this chapter is about
 *   ...                anything a later version adds
 *
 * Extensibility rule: parts this build doesn't recognise are carried through
 * untouched on load and written back on save. A newer Mari can add chapter
 * links (or whatever comes next) and an older build opening that file won't
 * quietly strip them.
 */
export const MARI_FORMAT_VERSION = 1;
export const MARI_EXTENSION = ".mari";

const MANIFEST = "manifest.json";
const CONTENT = "content.md";
const HIGHLIGHTS = "highlights.json";
const NOTES = "notes.json";
const HISTORY = "history.json";
const SYNOPSIS = "synopsis.json";
const CUTS = "cuts.json";

/** Files this build understands; everything else is preserved verbatim. */
const KNOWN_PARTS = new Set([MANIFEST, CONTENT, HIGHLIGHTS, NOTES, HISTORY, SYNOPSIS, CUTS]);

/**
 * What this chapter is, held as two separate things.
 *
 * `plan` is intent, written before drafting: what the chapter has to get done,
 * in order. `text` is the synopsis — what the chapter actually does, written
 * after. Keeping them apart is the point: the drift between them is worth
 * seeing.
 *
 * An object rather than bare strings so it can gain fields later — POV,
 * location, a word target — without changing shape or needing a format bump.
 */
/** One step of the plan: what has to happen, and whether it has yet. */
export interface MariPlanBeat {
  text: string;
  /** Ticked off while drafting. */
  done?: boolean;
  [key: string]: unknown;
}

export interface MariSynopsis {
  /** What happens in this chapter, in a sentence or two. */
  text: string;
  /** What the chapter is meant to do, as an ordered sequence of beats. */
  plan: MariPlanBeat[];
  [key: string]: unknown;
}

/** A fresh blank one. A function, so no two chapters share a `plan` array. */
export function emptySynopsis(): MariSynopsis {
  return { text: "", plan: [] };
}

/**
 * Beats were plain strings before they could be ticked off, and files written
 * then are still out there — so a string is read as an unticked beat rather
 * than thrown away.
 */
function normalizePlan(value: unknown): MariPlanBeat[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((beat) => {
      if (typeof beat === "string") return { text: beat };
      if (beat && typeof beat === "object" && typeof (beat as MariPlanBeat).text === "string") {
        return { ...(beat as MariPlanBeat), done: (beat as MariPlanBeat).done === true };
      }
      return null;
    })
    .filter((beat): beat is MariPlanBeat => beat !== null);
}

/**
 * Fills in anything missing or the wrong type. Files written before `plan`
 * existed simply don't carry it, and a hand-edited file can carry anything.
 */
function normalizeSynopsis(value: MariSynopsis): MariSynopsis {
  return {
    ...value,
    text: typeof value.text === "string" ? value.text : "",
    plan: normalizePlan(value.plan),
  };
}

/**
 * A passage taken out of the prose but kept. Not a version of anything — it
 * simply isn't in the chapter any more, and the writer wasn't ready to lose it.
 */
export interface MariCut {
  id: string;
  text: string;
  /** ISO timestamp of when it left the prose. */
  cutAt: string;
  /** Why it went, if the writer said. */
  note?: string;
  /**
   * The prose either side of it when it left. Used to aim "Put back" — an
   * offset would rot with the next edit, but the surrounding words survive.
   */
  before?: string;
  after?: string;
  [key: string]: unknown;
}

/** Drops entries a hand-edited file might have mangled. */
function normalizeCuts(value: unknown): MariCut[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((cut): cut is MariCut => !!cut && typeof cut === "object" && typeof cut.text === "string")
    .map((cut, index) => ({
      ...cut,
      id: typeof cut.id === "string" && cut.id ? cut.id : `cut-${index}-${Date.now()}`,
      cutAt: typeof cut.cutAt === "string" ? cut.cutAt : "",
    }));
}

export interface MariManifest {
  format: "mari";
  version: number;
  /** Set by whichever build wrote the file — useful when diagnosing old files. */
  generator?: string;
  savedAt?: string;
  [key: string]: unknown;
}

export interface MariBundle {
  text: string;
  highlights: StoredHighlight[];
  notes: Record<string, string>;
  history: Record<string, ChunkVersion[]>;
  synopsis: MariSynopsis;
  cuts: MariCut[];
  manifest: MariManifest;
  /**
   * Parts from a newer (or simply unknown) version, kept byte-for-byte so
   * saving doesn't destroy them. Callers never need to look at this.
   */
  unknownParts: Record<string, Uint8Array>;
}

function parseJson<T>(bytes: Uint8Array | undefined, fallback: T): T {
  if (!bytes) return fallback;
  try {
    const parsed = JSON.parse(strFromU8(bytes));
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    // A corrupt part shouldn't cost the user their prose — drop just that part.
    return fallback;
  }
}

export function isMariFile(name: string): boolean {
  return name.toLowerCase().endsWith(MARI_EXTENSION);
}

/** Builds the zip bytes for a `.mari` file. */
export function packMariBundle(bundle: {
  text: string;
  highlights: StoredHighlight[];
  notes: Record<string, string>;
  history: Record<string, ChunkVersion[]>;
  synopsis?: MariSynopsis;
  cuts?: MariCut[];
  manifest?: Partial<MariManifest>;
  unknownParts?: Record<string, Uint8Array>;
}): Uint8Array {
  // Never stamp the version *down*. An older build opening a newer file
  // preserves the parts it doesn't understand (see unknownParts), so the file
  // is still genuinely that newer version — relabelling it would make a future
  // build read it as old and ignore data that's actually still in there.
  const incomingVersion = Number(bundle.manifest?.version);
  const manifest: MariManifest = {
    ...bundle.manifest,
    format: "mari",
    version: Number.isFinite(incomingVersion)
      ? Math.max(MARI_FORMAT_VERSION, incomingVersion)
      : MARI_FORMAT_VERSION,
    savedAt: new Date().toISOString(),
  };

  const files: Record<string, Uint8Array> = {
    // Unknown parts first so a known name always wins if they ever collide.
    ...(bundle.unknownParts ?? {}),
    [MANIFEST]: strToU8(JSON.stringify(manifest, null, 2)),
    [CONTENT]: strToU8(bundle.text),
    [HIGHLIGHTS]: strToU8(JSON.stringify(bundle.highlights)),
    [NOTES]: strToU8(JSON.stringify(bundle.notes)),
    [HISTORY]: strToU8(JSON.stringify(bundle.history)),
    [SYNOPSIS]: strToU8(JSON.stringify(bundle.synopsis ?? emptySynopsis())),
    [CUTS]: strToU8(JSON.stringify(bundle.cuts ?? [])),
  };

  return zipSync(files, { level: 6 });
}

/** Reads a `.mari` file's bytes back into its parts. Throws if it isn't a zip. */
export function unpackMariBundle(bytes: Uint8Array): MariBundle {
  const files = unzipSync(bytes);

  const unknownParts: Record<string, Uint8Array> = {};
  for (const [name, data] of Object.entries(files)) {
    if (!KNOWN_PARTS.has(name)) unknownParts[name] = data;
  }

  const manifest = parseJson<MariManifest>(files[MANIFEST], {
    format: "mari",
    version: MARI_FORMAT_VERSION,
  });

  return {
    text: files[CONTENT] ? strFromU8(files[CONTENT]) : "",
    highlights: parseJson<StoredHighlight[]>(files[HIGHLIGHTS], []),
    notes: parseJson<Record<string, string>>(files[NOTES], {}),
    history: parseJson<Record<string, ChunkVersion[]>>(files[HISTORY], {}),
    synopsis: normalizeSynopsis(parseJson<MariSynopsis>(files[SYNOPSIS], emptySynopsis())),
    cuts: normalizeCuts(parseJson<MariCut[]>(files[CUTS], [])),
    manifest,
    unknownParts,
  };
}
