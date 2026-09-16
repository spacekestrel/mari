/**
 * The app's English text, and the shape every other locale is checked against.
 *
 * Anything the writer can read lives here rather than inline in a component,
 * so a translator can see the whole of Mari's voice in one place. Strings that
 * need a name or a number are functions, not templates with placeholders —
 * word order differs between languages, and a function lets each translation
 * put the pieces where its own grammar wants them.
 */
export const en = {
  /** Written into <html lang>, and used for dates and number formatting. */
  tag: "en",

  menu: {
    open: "Menu",
    label: "File menu",
    newFile: "New file",
    openFile: "Open file",
    openFolder: "Open folder",
    save: "Save",
    exportAs: "Export as…",
    terminal: "Terminal",
    lightMode: "Light mode",
    darkMode: "Dark mode",
    settings: "Settings",
    back: "Back",
  },

  settings: {
    title: "Settings",
    font: "Font",
    language: "Language",
    confirmations: "Confirmations",
    confirmBeforeDeleting: "Confirm before deleting",
  },

  toolbar: {
    toggleSidebar: "Toggle sidebar",
    bookLayout: "Book layout: indented, no gaps. Click for spaced paragraphs.",
    spacedLayout: "Spaced paragraphs. Click for book layout.",
    paragraphLayout: "Paragraph layout",
    edit: "Edit (Ctrl+Shift+V)",
    preview: "Preview (Ctrl+Shift+V)",
    togglePreview: "Toggle preview",
    showToolbar: "Show toolbar (Esc)",
    focusMode: "Focus mode",
    toggleFocusMode: "Toggle focus mode",
  },

  window: {
    minimize: "Minimize",
    maximize: "Maximize",
    close: "Close",
  },

  document: {
    untitled: "Untitled.mari",
    nothingOpen: "Nothing open",
    nothingOpenHint: "Open a folder or a file to start.",
    words: (n: number) => `${n} words`,
    characters: (n: number) => `${n} characters`,
  },

  status: {
    saved: "Saved",
    savedHighlightsNeedMari: "Saved — highlights need a .mari file",
    savedMarksNeedMari: "Saved — marks need a .mari file",
    exported: "Exported",
    exportedHighlightsStay: "Exported — highlights stay in the .mari",
    couldntSave: "Couldn't save",
    couldntExport: "Couldn't export",
    couldntOpenFile: "Couldn't open file",
    couldntOpenFolder: "Couldn't open folder",
    couldntCreateFile: "Couldn't create file",
    couldntCreateFolder: "Couldn't create folder",
    couldntDelete: "Couldn't delete",
    couldntKeepUnsaved: "Couldn't keep unsaved changes for next time",
    couldntReopen: (name: string) => `Couldn't reopen ${name}`,
    movedTo: (name: string) => `Moved to ${name}`,
    couldntMove: (name: string) => `Couldn't move ${name}`,
    /** How a failure and the reason the OS gave are joined into one line. */
    failure: (what: string, reason: string) => `${what} — ${reason}`,
  },

  dialog: {
    cancel: "Cancel",
    delete: "Delete",
    dontAskAgain: "Don't ask again",
    discard: "Discard",
    discardTitle: "Discard unsaved changes?",
    discardMessage: (name: string) =>
      `Your changes to ${name} haven't been saved. Save first if you want to keep them.`,
    deleteTitle: (name: string) => `Delete ${name}?`,
    deleteFolderMessage: "This deletes the folder and everything inside it. This can't be undone.",
    deleteFileMessage: "This can't be undone.",
  },

  sidebar: {
    newFile: "New file",
    newFolder: "New folder",
    loading: "Loading…",
    couldntOpenFolder: "Couldn't open this folder",
    folderGone: "This folder no longer exists",
    emptyFolder: "Empty folder",
    resize: "Resize sidebar",
    dragToResize: "Drag to resize — double-click to reset",
    filePlaceholder: "chapter.mari",
    folderPlaceholder: "folder name",
  },

  format: {
    label: "Formatting",
    bold: "Bold",
    italic: "Italic",
    strikethrough: "Strikethrough",
    heading: "Heading",
    subheading: "Subheading",
    quote: "Quote",
  },

  markdown: {
    cheatSheet: "Markdown cheat sheet",
    title: "Markdown",
    heading: "Heading",
    bold: "Bold",
    italic: "Italic",
    quote: "Quote",
    bulletList: "Bullet list",
    numberedList: "Numbered list",
    link: "Link",
    sceneBreak: "Scene break",
  },

  editor: {
    placeholder: "Start writing...",
    copied: "Copied",
    copyChapter: "Copy the whole chapter",
    clearHighlight: "Clear highlight",
    passageActions: "Passage actions",
    movePassage: "Move this passage",
    viewHistory: "View version history",
    draftRewrite: "Draft a rewrite",
    moveToDrawer: "Move this passage to the drawer",
    addNote: "Add a note",
    note: (text: string) => `Note: ${text}`,
    passageNote: "Passage note",
    notePlaceholder: "What needs doing here?",
    repositioning: (preview: string) =>
      `Repositioning: "${preview}" — click where it should go, or press Esc to cancel.`,
  },

  /** Keyed by the ids in highlightStates.ts, which are what files store. */
  highlights: {
    good: "Good",
    "ok-for-now": "OK for now",
    tweak: "Tweak",
    reposition: "Reposition",
    rewrite: "Rewrite",
    expand: "Expand",
    cut: "Cut",
    unsure: "Unsure",
  } as Record<string, string>,

  draft: {
    write: "Draft a rewrite",
    compare: "Compare",
    history: "Version history",
    resize: "Resize panel",
    dragToResize: "Drag to resize — double-click to reset",
    close: "Close",
    placeholder: "Write your rewrite here...",
    earlierVersions: (n: number) => `${n} earlier version${n === 1 ? "" : "s"}`,
    original: "Original",
    draft: "Draft",
    current: "Current",
    afterwards: "Afterwards",
    noMark: "No mark",
    leaveMarked: (label: string) => `Leave this passage marked ${label}`,
    keepTweaking: "Keep tweaking",
    replace: "Replace",
    backToList: "Back to list",
    backToDraft: "Back to draft",
    beforeMove: "Before move",
    selectedVersion: "Selected version",
    restoreVersion: "Restore this version",
    movedBadge: "Moved",
    draftBadge: "Draft",
  },

  drawer: {
    title: "Drawer",
    close: "Close",
    empty: "The drawer is empty.",
    delete: "Delete",
    deleteForGood: "Delete for good",
    keepIt: "Keep it",
    copyText: "Copy the text",
    putBack: "Put back",
    wordCount: (n: number) => `${n} ${n === 1 ? "word" : "words"}`,
  },

  chapter: {
    synopsis: "Synopsis",
    synopsisPlaceholder: "What happens in this chapter?",
    plan: "Plan",
    planPlaceholder: "One step per line",
    edit: "Edit",
  },

  terminal: {
    title: "Terminal",
    clear: "Clear",
    close: "Close terminal",
  },

  search: {
    placeholder: "Find in chapter",
    noMatches: "no matches",
    position: (current: number, total: string) => `${current} of ${total}`,
    found: (total: string) => `${total} found`,
    previous: "Previous match",
    next: "Next match",
    close: "Close search",
  },
};

export type Strings = typeof en;
