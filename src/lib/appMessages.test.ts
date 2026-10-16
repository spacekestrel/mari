import { describe, expect, it } from "vitest";
import { chooseMessage, compareVersions, readMessages, today, type Reader } from "./appMessages";

/** A plain reader, overridden a field at a time by the tests that care. */
function reader(changes: Partial<Reader> = {}): Reader {
  return {
    version: "0.2.7",
    dismissed: [],
    today: "2026-10-10",
    locale: "en",
    linkLabel: "Read more",
    ...changes,
  };
}

const NOTE = { id: "note", title: "A note", body: "Something happened." };

describe("reading the file", () => {
  it("takes the usual wrapped shape", () => {
    expect(readMessages({ messages: [NOTE] })).toHaveLength(1);
  });

  it("takes a bare list too", () => {
    expect(readMessages([NOTE])).toHaveLength(1);
  });

  it("gives nothing back for nonsense instead of throwing", () => {
    for (const rubbish of [null, undefined, 7, "messages", {}, { messages: {} }, [[]]]) {
      expect(readMessages(rubbish), String(rubbish)).toEqual([]);
    }
  });

  it("drops a message with no id, title or body", () => {
    expect(readMessages([{ title: "x", body: "y" }])).toEqual([]);
    expect(readMessages([{ id: "a", body: "y" }])).toEqual([]);
    expect(readMessages([{ id: "a", title: "x" }])).toEqual([]);
    expect(readMessages([{ id: "  ", title: "x", body: "y" }])).toEqual([]);
  });

  it("keeps the good messages around a bad one", () => {
    const read = readMessages([NOTE, { id: "" }, { id: "two", title: "T", body: "B" }]);
    expect(read.map((m) => m.id)).toEqual(["note", "two"]);
  });

  it("keeps the first of two messages sharing an id", () => {
    const read = readMessages([NOTE, { id: "note", title: "Later", body: "B" }]);
    expect(read).toHaveLength(1);
    expect(read[0].title).toBe("A note");
  });

  it("reads no further than twenty messages", () => {
    const many = Array.from({ length: 50 }, (_, i) => ({ id: `m${i}`, title: "T", body: "B" }));
    expect(readMessages(many)).toHaveLength(20);
  });

  it("keeps text written per language, and ignores the parts that aren't text", () => {
    const read = readMessages([{ id: "a", title: { en: "Hello", ru: "Привет", de: 4 }, body: "B" }]);
    expect(read[0].title).toEqual({ en: "Hello", ru: "Привет" });
  });

  it("drops a message whose text is an empty object", () => {
    expect(readMessages([{ id: "a", title: {}, body: "B" }])).toEqual([]);
  });
});

describe("links from the file", () => {
  const withLink = (link: unknown) => readMessages([{ ...NOTE, link }])[0];

  it("keeps an https link", () => {
    expect(withLink({ url: "https://meowmari.ink", label: "Look" }).link)
      .toEqual({ url: "https://meowmari.ink/", label: "Look" });
  });

  it("throws away anything that isn't https, and keeps the message", () => {
    for (const url of [
      "javascript:alert(1)",
      "http://meowmari.ink",
      "file:///etc/passwd",
      "data:text/html,<script>x</script>",
      "not a url",
      42,
    ]) {
      const message = withLink({ url, label: "Look" });
      expect(message.link, String(url)).toBeNull();
      expect(message.title).toBe("A note");
    }
  });

  it("keeps a link whose label the file forgot", () => {
    expect(withLink({ url: "https://meowmari.ink" }).link)
      .toEqual({ url: "https://meowmari.ink/", label: null });
  });

  it("ignores a link that isn't even an object", () => {
    expect(withLink("https://meowmari.ink").link).toBeNull();
  });
});

describe("comparing versions", () => {
  it("knows which is older", () => {
    expect(compareVersions("0.2.7", "0.3.0")).toBe(-1);
    expect(compareVersions("0.3.0", "0.2.7")).toBe(1);
    expect(compareVersions("0.2.7", "0.2.7")).toBe(0);
  });

  it("counts rather than compares letters", () => {
    expect(compareVersions("0.9.0", "0.10.0")).toBe(-1);
    expect(compareVersions("1.0.0", "0.99.99")).toBe(1);
  });

  it("treats a missing part as zero", () => {
    expect(compareVersions("1.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0", "1.0.1")).toBe(-1);
  });

  it("puts a pre-release just below the version it leads to", () => {
    expect(compareVersions("0.3.0-beta1", "0.3.0")).toBe(0);
    expect(compareVersions("0.3.0-beta1", "0.2.9")).toBe(1);
  });
});

describe("choosing what to show", () => {
  it("shows the first message in the file", () => {
    const entries = readMessages([NOTE, { id: "older", title: "Older", body: "B" }]);
    expect(chooseMessage(entries, reader())?.id).toBe("note");
  });

  it("shows nothing when the file is empty", () => {
    expect(chooseMessage([], reader())).toBeNull();
  });

  it("moves on to the next one once the first is dismissed", () => {
    const entries = readMessages([NOTE, { id: "older", title: "Older", body: "B" }]);
    expect(chooseMessage(entries, reader({ dismissed: ["note"] }))?.id).toBe("older");
  });

  it("shows nothing once everything has been dismissed", () => {
    const entries = readMessages([NOTE]);
    expect(chooseMessage(entries, reader({ dismissed: ["note"] }))).toBeNull();
  });

  it("stops announcing a version to someone who already has it", () => {
    const entries = readMessages([{ ...NOTE, forVersionsBelow: "0.3.0" }]);
    expect(chooseMessage(entries, reader({ version: "0.2.7" }))?.id).toBe("note");
    expect(chooseMessage(entries, reader({ version: "0.3.0" }))).toBeNull();
    expect(chooseMessage(entries, reader({ version: "0.4.1" }))).toBeNull();
  });

  it("lets a message run out", () => {
    const entries = readMessages([{ ...NOTE, expires: "2026-10-10" }]);
    expect(chooseMessage(entries, reader({ today: "2026-10-10" }))?.id).toBe("note");
    expect(chooseMessage(entries, reader({ today: "2026-10-11" }))).toBeNull();
  });

  it("speaks the reader's language, and falls back to English", () => {
    const entries = readMessages([
      { id: "a", title: { en: "Out now", ru: "Уже вышло" }, body: { en: "Body", ru: "Текст" } },
    ]);
    expect(chooseMessage(entries, reader({ locale: "ru" }))?.title).toBe("Уже вышло");
    expect(chooseMessage(entries, reader({ locale: "de" }))?.title).toBe("Out now");
  });

  it("skips a message written in no language this person reads", () => {
    const entries = readMessages([{ id: "a", title: { ru: "Только по-русски" }, body: { ru: "Текст" } }]);
    expect(chooseMessage(entries, reader({ locale: "de" }))).toBeNull();
  });

  it("names an unlabelled link in the app's own words", () => {
    const entries = readMessages([{ ...NOTE, link: { url: "https://meowmari.ink" } }]);
    expect(chooseMessage(entries, reader({ linkLabel: "Подробнее" }))?.link)
      .toEqual({ url: "https://meowmari.ink/", label: "Подробнее" });
  });

  it("prefers the file's own label", () => {
    const entries = readMessages([{ ...NOTE, link: { url: "https://meowmari.ink", label: { en: "See it" } } }]);
    expect(chooseMessage(entries, reader())?.link?.label).toBe("See it");
  });
});

describe("today", () => {
  it("writes the date the way the file does", () => {
    expect(today(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(today(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});
