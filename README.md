# Mari

<p align="center">
  <img src="docs/mari-idle.gif" width="160" alt="Mari the cat, blinking and licking her paw">
</p>

**Mari is a cat.** 🐈‍⬛

Mari is also a free writing app for writers. ✍️

It's where you write the whole thing: draft it, keep the chapters in order,
and work it into shape. It goes furthest on the part most tools ignore, which
is revising.

> **Status:** early. Usable daily, but expect rough edges and occasional
> breaking changes before 1.0.

---

## 📸 What it looks like

<!-- Replace these with real captures before publishing. -->

| Writing, with highlights | Draft & compare | Focus mode |
|---|---|---|
| _screenshot_ | _screenshot_ | _screenshot_ |

---

## 💡 Why Mari

Most editors treat a manuscript as one long undifferentiated blob of text.
Revision doesn't work that way. You read a chapter and think *this paragraph
stays, this one's flabby, this scene belongs three chapters earlier, I'm not
sure about this line at all*. And then you have nowhere to put those
judgments except a separate notes file that immediately goes stale.

Mari puts them on the text itself, and gives you tools to act on them.

---

## 📦 What a chapter actually is

Every chapter you write is one **`.mari`** file. Not a folder, not a database,
not an account somewhere. One file you can move, back up, rename, or email to
someone.

What makes it different is what it holds. A `.docx` or a `.txt` can only store
the words. Everything you *think* about those words has to live somewhere else:
a notes document, comments that get stripped on the way out, a separate file
that drifts out of date the moment you rewrite a paragraph.

A `.mari` file keeps them together. Inside one file:

| | |
|---|---|
| ✍️ **Your prose** | the chapter itself, as plain text |
| 🖍️ **Highlights** | which passages are good, flabby, unfinished, wrong |
| 📝 **Notes** | what you actually meant by each one |
| 🔀 **Drafts** | every alternative wording you tried, including the ones you replaced |
| 🧭 **Synopsis and plan** | what the chapter is about, and what it still has to do |
| 🗄️ **Drawer** | passages you cut but couldn't bring yourself to delete |

So the chapter travels with its own revision history. Copy it to a memory
stick and the highlights come too. Come back in six months and the reason you
flagged that paragraph is still attached to that paragraph, not lost in a
notes file you no longer remember writing.

### Nothing is locked in

A `.mari` file is an ordinary zip. Rename it to `.zip`, open it, and your
writing is sitting there as a plain text file you can read in anything. No
encryption, no proprietary encoding, no account required to open your own work.
**If Mari vanished tomorrow, your manuscript is one rename away.**

Mari opens `.docx`, `.md` and `.txt` as well, and writes them back out, so a
chapter can go to an editor and come back. Those formats can only carry the
words, so the highlights and notes stay in the `.mari` file. Mari tells you
that when you save one, rather than letting the work disappear quietly.

---

## 🖍️ Highlights

Select a passage and say what it needs. `Alt+1` to `Alt+8`, or right-click.

| | Highlight | Meaning |
|---|---|---|
| 🟢 | **Good** | This landed |
| 🔵 | **OK for now** | Fine, but provisional |
| 🟡 | **Tweak** | Small changes needed |
| 🩵 | **Reposition** | Good text, wrong place |
| 🟠 | **Rewrite** | Needs real rework |
| 🟣 | **Expand** | Needs more here |
| 🔴 | **Cut** | Should go |
| ⚪ | **Unsure** | Haven't decided |

They stay put as you write around them. Rewrite a paragraph above and the
highlights below don't drift. With nothing selected the whole paragraph is
highlighted; press the same key again to clear it.

The shortcuts work on any keyboard layout, including non-Latin ones.

---

## 📝 Notes

Any highlighted passage takes a short note saying what you actually meant.
*"Too slow, cut to the argument."* *"Keep, but check the timeline here."*

The note icon fills in when a passage carries one, so you can see at a glance
which ones have something to say.

---

## 🔀 Draft and compare

Highlighted something **Rewrite**, **Tweak**, **Expand** or **Unsure**? Open
the passage and draft an alternative beside it. Your manuscript stays
untouched while you work.

- See the two versions side by side, with the changed words picked out
- Keep tweaking, or replace
- **Every version you replace is kept**, and can be read or restored later
- Replacing clears the highlight, because you've done the work. Keep a
  different one if it still needs another look.

---

## 🗄️ The drawer

Some passages you don't want in the chapter but can't bring yourself to
delete. Highlight one **Cut** and there's a button to put it in the drawer:
out of your prose, still in the file.

Open the drawer to read what's in there, copy it, put a passage back where it
came from, or delete it for good. It's the only thing in Mari that actually
destroys anything, and it asks first.

---

## 🎬 Reposition

Highlight a passage **Reposition** and Mari stages a move. The text stays
visible while you scroll to find its new home, then one click places it, and
one undo takes it back.

---

## 🧭 Synopsis and plan

Three quiet words at the top of every chapter.

- **Synopsis** is what the chapter is about, in a line
- **Plan** is what it has to get done, as a list of beats you tick off as you
  write them
- **Drawer** is everything you've cut out of it

They save themselves the moment you change them.

---

## 🗺️ Minimap

A small picture of the whole chapter down the side. Too small to read, but you
can see its shape, where the long paragraphs are and where the dialogue thins
out. Your highlights show as coloured bands, so a chapter's trouble spots are
visible at a glance. Click anywhere to jump there.

---

## 🌙 Focus mode

Your writing fills the screen and everything else gets out of the way:
toolbar, chapter list, word count, minimap, even the highlights. Nothing left
but the prose. `Esc` brings it back.

---

## ✨ And the rest

- 📁 **Project folders**, so you can open your manuscript folder and browse it
  as a chapter tree, which reopens as you left it
- 📍 **Back where you were**, so reopening a chapter puts you at the paragraph
  you were reading, not the top
- 💾 **Nothing lost**: unsaved changes wait for you when you switch chapters,
  and are still there after closing the app
- 📋 **Copy the whole chapter** with one click
- 🌗 **Light and dark**, with a font picker
- 🔢 **Live word and character count**
- 📖 **Reading view** for Markdown files, `Ctrl+Shift+V`

---

## ⬇️ Install

Grab the installer for your computer from
[Releases](../../releases/latest).

| | What to download |
|---|---|
| 🪟 **Windows** | `.exe`, the ordinary installer. Or `.msi` if your workplace prefers it. |
| 🍎 **macOS** | `.dmg`. Take **aarch64** for Apple silicon (M1 and later), **x64** for older Intel Macs. |
| 🐧 **Linux** | `.AppImage` runs anywhere without installing. Or `.deb` for Debian and Ubuntu, `.rpm` for Fedora. |

Mari isn't code-signed yet, so the first launch shows a warning:

- **Windows** says "unrecognised app". Click *More info*, then *Run anyway*.
- **macOS** blocks it. Right-click the app and choose *Open* rather than
  double-clicking.

Signing certificates cost money every year. This will be sorted out before 1.0.

<details>
<summary>Building it yourself</summary>

Requires [Node.js](https://nodejs.org) 18+ and
[Rust](https://www.rust-lang.org/tools/install).

On Linux you also need:

```bash
sudo apt install libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev \
  patchelf build-essential curl wget file
```

Other distributions: see
[Tauri's prerequisites](https://tauri.app/start/prerequisites/). Windows needs
Microsoft's C++ Build Tools; macOS needs Xcode Command Line Tools.

```bash
npm install
npm run tauri build     # installer for your OS, in src-tauri/target/release/bundle/
```

</details>

---

## ⌨️ Keyboard shortcuts

| | |
|---|---|
| `Alt+1` … `Alt+8` | Highlight the selection, or the paragraph |
| `Alt+0` | Clear the highlight |
| `Ctrl+N` | New chapter |
| `Ctrl+O` | Open a file |
| `Ctrl+Shift+O` | Open a project folder |
| `Ctrl+S` | Save |
| `Ctrl+Shift+S` | Export a copy |
| `Ctrl+Shift+V` | Reading view |
| `Esc` | Leave focus mode |

---

## ⚖️ License

[GNU AGPL-3.0-or-later](LICENSE).

In short: Mari is free software, and it stays that way. You can use, study,
modify and share it. If you distribute a modified version, or run one as a
network service, you have to make your source available under the same
terms.

Commercial licensing for cases where AGPL doesn't fit is available on request.
