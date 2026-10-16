# The news card

Mari shows one small card at the foot of the sidebar. The words come from
[`docs/messages.json`](messages.json), which is published to
`https://meowmari.ink/messages.json` by the Website workflow.

Edit the file, push to `main`, and every copy of Mari picks it up the next time
someone opens the app. Nothing has to be released, and nobody has to update.

## Writing a message

Put the newest at the top of `messages`. Mari shows the first one that applies,
so the top of the list is the thing you most want read.

```json
{
  "id": "0-3-0",
  "title": "Mari 0.3.0 is out",
  "body": "Rename chapters in the sidebar, and no more stray asterisks.",
  "link": { "url": "https://meowmari.ink", "label": "What changed" },
  "forVersionsBelow": "0.3.0",
  "expires": "2026-12-31"
}
```

| Field | Needed | What it does |
| --- | --- | --- |
| `id` | yes | Anything, as long as no other message uses it. Closing the card remembers this, so never reuse an id for different words. |
| `title` | yes | One short line, in bold. |
| `body` | yes | A sentence or two. |
| `link` | no | `url` must start with `https://`. Opens in the person's browser. `label` is optional and defaults to "Read more" in their language. |
| `forVersionsBelow` | no | Hides the message from anyone already on this version or newer. Use it for release news so it stops nagging people who updated. |
| `expires` | no | `YYYY-MM-DD`. The message is gone the day after. |

Any of `title`, `body` and `label` can be one string for everyone:

```json
"title": "Mari 0.3.0 is out"
```

or one per language, and anyone whose language is missing reads the English:

```json
"title": { "en": "Mari 0.3.0 is out", "ru": "Mari 0.3.0 уже вышла" }
```

A message with no English and no match for the reader's language is skipped
rather than shown blank.

## Leaving old messages in

Closing the card only hides that one message. The next one down then gets its
turn, so an older entry can still reach somebody who dismissed the newest.
Mari reads the first 20 and ignores the rest; below that, delete freely.

## An empty file

To say nothing at all:

```json
{ "messages": [] }
```

The card disappears. Anything Mari can't make sense of is skipped the same way,
so a typo in one message doesn't take the others down with it.

## What the app sends

Nothing. The request is a plain GET of a public file — no name, no account, no
version, not even a count. If it fails the app says nothing and carries on with
the last file it saw, which is also what keeps the card working offline.
