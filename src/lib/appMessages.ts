/**
 * Which of Mari's own messages a person should be shown.
 *
 * Mari keeps a small card at the foot of the sidebar for news about itself: a
 * new version, a note, something worth a link. The words live in a file on
 * Mari's website rather than inside the app, so something can still be said
 * about a version that has already shipped.
 *
 * That makes it the one piece of text in Mari that nobody here has read, so
 * none of it is trusted. A message without an id or without words is dropped,
 * a link that isn't plain https is thrown away and the message kept, and the
 * file is only ever read for the first few entries. Nothing in this file
 * fetches or draws anything — it only decides.
 */

import type { LocaleId } from "./i18n.svelte";

/** One string for everyone, or one per language. */
export type Text = string | Partial<Record<LocaleId, string>>;

/** A message as the file writes it, conditions and all. */
export interface MessageEntry {
  id: string;
  title: Text;
  body: Text;
  /** A label of null means the card uses its own translated wording. */
  link: { url: string; label: Text | null } | null;
  /** Hidden from anyone already running this version or a newer one. */
  forVersionsBelow: string | null;
  /** Gone the day after this one, written YYYY-MM-DD. */
  expires: string | null;
}

/** A message settled into one language, ready to draw. */
export interface Message {
  id: string;
  title: string;
  body: string;
  link: { url: string; label: string } | null;
}

/**
 * How far into the file to read.
 *
 * Only one message is ever shown, and the rest are there so an older one can
 * still reach somebody who dismissed the newest. A few is plenty, and a cap
 * means a file that grows without anyone tidying it can't slow a launch.
 */
const MOST = 20;

/** Today by the reader's own clock, as YYYY-MM-DD, which is how dates sort. */
export function today(now: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/**
 * Two version strings, compared the way versions mean it.
 *
 * Negative when a is older. Segments are numbers, a missing one counts as 0,
 * and anything that isn't a number counts as 0 too — so 0.3.0-beta sorts just
 * below 0.3.0 rather than throwing the whole comparison out.
 */
export function compareVersions(a: string, b: string): number {
  const parts = (v: string) => v.split(".").map((part) => parseInt(part, 10) || 0);
  const left = parts(a);
  const right = parts(b);
  for (let i = 0; i < Math.max(left.length, right.length); i++) {
    const difference = (left[i] ?? 0) - (right[i] ?? 0);
    if (difference !== 0) return difference < 0 ? -1 : 1;
  }
  return 0;
}

/** A string, or one string per language, or nothing usable. */
function readText(value: unknown): Text | null {
  if (typeof value === "string") return value.trim() || null;
  if (typeof value !== "object" || value === null) return null;

  const byLanguage: Partial<Record<LocaleId, string>> = {};
  for (const [language, written] of Object.entries(value)) {
    if (typeof written === "string" && written.trim()) {
      byLanguage[language as LocaleId] = written.trim();
    }
  }
  return Object.keys(byLanguage).length > 0 ? byLanguage : null;
}

/**
 * A link Mari is willing to hand to the browser, or nothing.
 *
 * https only. The card opens whatever this says in the system browser, and
 * the file saying it arrived over the network, so schemes that can run code
 * or reach into the disk never get that far.
 */
function readUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.href : null;
  } catch {
    return null;
  }
}

function readDay(value: unknown): string | null {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function readVersion(value: unknown): string | null {
  return typeof value === "string" && /\d/.test(value) ? value.trim() : null;
}

function readEntry(value: unknown): MessageEntry | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;

  const id = typeof row.id === "string" ? row.id.trim() : "";
  const title = readText(row.title);
  const body = readText(row.body);
  if (!id || !title || !body) return null;

  const url = typeof row.link === "object" && row.link !== null
    ? readUrl((row.link as Record<string, unknown>).url)
    : null;
  const label = url && typeof row.link === "object" && row.link !== null
    ? readText((row.link as Record<string, unknown>).label)
    : null;

  return {
    id,
    title,
    body,
    link: url ? { url, label } : null,
    forVersionsBelow: readVersion(row.forVersionsBelow),
    expires: readDay(row.expires),
  };
}

/**
 * Everything usable in the file, in the order it was written.
 *
 * Takes either `{ "messages": [...] }` or a bare list, and skips anything it
 * can't make sense of instead of giving up on the file.
 */
export function readMessages(raw: unknown): MessageEntry[] {
  const wrapped = (raw as { messages?: unknown } | null | undefined)?.messages;
  const list = Array.isArray(raw) ? raw : Array.isArray(wrapped) ? wrapped : [];

  const found: MessageEntry[] = [];
  for (const value of list.slice(0, MOST)) {
    const entry = readEntry(value);
    // Two entries under one id would share a dismissal, so the first wins.
    if (entry && !found.some((seen) => seen.id === entry.id)) found.push(entry);
  }
  return found;
}

/** This language, or English, or nothing. */
function inLanguage(text: Text, locale: LocaleId): string | null {
  if (typeof text === "string") return text;
  return text[locale] ?? text.en ?? null;
}

export interface Reader {
  /** The version of Mari now running. */
  version: string;
  /** Ids this person has already closed. */
  dismissed: readonly string[];
  today: string;
  locale: LocaleId;
  /** What a link says when the file didn't name it. */
  linkLabel: string;
}

/**
 * The one message to show, or nothing.
 *
 * The file's order is the order of preference, so whoever writes it puts the
 * thing they most want read at the top. Dismiss that and the next one down
 * gets its turn, which is why old entries are worth leaving in the file.
 */
export function chooseMessage(entries: readonly MessageEntry[], reader: Reader): Message | null {
  for (const entry of entries) {
    if (reader.dismissed.includes(entry.id)) continue;
    if (entry.expires && reader.today > entry.expires) continue;
    if (entry.forVersionsBelow && compareVersions(reader.version, entry.forVersionsBelow) >= 0) continue;

    const title = inLanguage(entry.title, reader.locale);
    const body = inLanguage(entry.body, reader.locale);
    // A message that was never written in a language this person reads is
    // skipped rather than shown as a blank card.
    if (!title || !body) continue;

    const link = entry.link
      ? { url: entry.link.url, label: (entry.link.label && inLanguage(entry.link.label, reader.locale)) || reader.linkLabel }
      : null;

    return { id: entry.id, title, body, link };
  }
  return null;
}
