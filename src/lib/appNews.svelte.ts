/**
 * Mari's own news, and the card that shows it.
 *
 * Once at launch the app asks Mari's website for a small file of messages. If
 * one of them is worth this person's attention, it appears at the foot of the
 * sidebar until they close it. If the fetch fails — no network, website down,
 * file half-written — nothing is said and nothing is broken: the app has
 * never needed this file to work, and it already has the last one it saw.
 *
 * This is the only moment Mari talks to the network. It sends nothing: no
 * name, no file, no count, not even which version is asking. The request is a
 * plain GET of a public file, the same one anyone could open in a browser.
 */

import { readMessages, chooseMessage, today, type Message, type MessageEntry } from "./appMessages";
import { appVersion } from "./appVersion";
import { i18n } from "./i18n.svelte";

/** Published out of docs/ by the Website workflow, next to the landing page. */
const SOURCE = "https://meowmari.ink/messages.json";

const CLOSED_KEY = "mari-news-closed";
const SAVED_KEY = "mari-news";

/** Long enough for a slow connection, short enough to forget about. */
const PATIENCE = 8000;

function stored(key: string): unknown {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function keep(key: string, value: unknown) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // A full disk is not worth a word on screen over a news card.
  }
}

function closedIds(): string[] {
  const saved = stored(CLOSED_KEY);
  return Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string") : [];
}

class AppNews {
  /**
   * The last messages seen, kept on disk.
   *
   * Starting from what was saved means the card is already there on launch
   * rather than appearing a second late, and that it is still there on a
   * train with no signal.
   */
  #entries = $state<MessageEntry[]>(readMessages(stored(SAVED_KEY)));
  #closed = $state<string[]>(closedIds());

  /** The one message to show now, or nothing at all. */
  readonly current = $derived.by<Message | null>(() =>
    chooseMessage(this.#entries, {
      version: appVersion,
      dismissed: this.#closed,
      today: today(),
      locale: i18n.current,
      linkLabel: i18n.t.news.more,
    }),
  );

  /**
   * Asks the website what's new. Called once, at launch.
   *
   * Every failure is the same failure — there is no news — so they are all
   * swallowed together. Nothing here is allowed to delay or break a launch.
   */
  async refresh() {
    if (typeof fetch === "undefined") return;

    const giveUp = new AbortController();
    const timer = setTimeout(() => giveUp.abort(), PATIENCE);
    try {
      const response = await fetch(SOURCE, { signal: giveUp.signal, cache: "no-store" });
      if (!response.ok) return;
      const raw = await response.json();
      const read = readMessages(raw);
      this.#entries = read;
      keep(SAVED_KEY, raw);
      // Ids no longer in the file are dropped from the closed list, so it
      // can't grow for ever off the back of messages nobody will see again.
      this.#closed = this.#closed.filter((id) => read.some((entry) => entry.id === id));
      keep(CLOSED_KEY, this.#closed);
    } catch (reason) {
      console.debug("No news from Mari's website", reason);
    } finally {
      clearTimeout(timer);
    }
  }

  /** Closed for good: this message never comes back on this computer. */
  close(id: string) {
    if (this.#closed.includes(id)) return;
    this.#closed = [...this.#closed, id];
    keep(CLOSED_KEY, this.#closed);
  }
}

export const appNews = new AppNews();
