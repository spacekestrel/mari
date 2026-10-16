# Flathub packaging

What the software shops read. These are the files that make Mari look like a
real application in GNOME Software, KDE Discover and Ubuntu's App Center,
rather than "Unknown publisher, License unknown".

| File | What it is |
| --- | --- |
| `ink.meowmari.Mari.metainfo.xml` | Name, summary, description, screenshots, licence, release notes |
| `ink.meowmari.Mari.desktop` | The entry in the applications menu |
| `ink.meowmari.Mari.png` | 256x256 icon |

Check them after any edit:

```
appstreamcli validate flatpak/ink.meowmari.Mari.metainfo.xml
desktop-file-validate flatpak/ink.meowmari.Mari.desktop
```

## Still to do before submitting

- The build recipe (`ink.meowmari.Mari.yml`). Flatpak builds with no network,
  so every Rust crate and npm package has to be listed in generated files first.
- Change the app's identifier in `src-tauri/tauri.conf.json` from
  `com.mari.editor` to `ink.meowmari.Mari`. Flathub requires an id on a domain
  you control. It moves where Mari keeps its settings, so everyone running it
  loses their preferences once.
- The terminal is already gone, so there is nothing left that the sandbox
  breaks.
- A release entry per version. Shops show these as "What's New".

## Notes

The desktop entry deliberately claims no file types and takes no file
argument: Mari ignores anything passed on the command line, so offering to
open `.docx` from the file manager would open an empty window instead.

`appstreamcli` grumbles that the id has a capital letter in it. That is the
Flathub convention — `org.gnome.Builder`, `com.spotify.Client` — and the rule
it cites only applies to the domain part.
