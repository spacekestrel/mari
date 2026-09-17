import type { Strings } from "./en";

/**
 * Russian counting: 1 слово, 2 слова, 5 слов — and 11–14 follow the "many"
 * form even though they end in 1–4. Every count the writer sees goes through
 * this, so nothing reads like a machine wrote it.
 */
function plural(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

export const ru: Strings = {
  tag: "ru",

  menu: {
    open: "Меню",
    label: "Меню файла",
    newFile: "Новый файл",
    openFile: "Открыть файл",
    openFolder: "Открыть папку",
    save: "Сохранить",
    exportAs: "Экспортировать как…",
    terminal: "Терминал",
    lightMode: "Светлая тема",
    darkMode: "Тёмная тема",
    settings: "Настройки",
    back: "Назад",
  },

  settings: {
    title: "Настройки",
    font: "Шрифт",
    language: "Язык",
    confirmations: "Подтверждения",
    confirmBeforeDeleting: "Спрашивать перед удалением",
  },

  toolbar: {
    toggleSidebar: "Показать или скрыть боковую панель",
    bookLayout: "Книжная вёрстка: с красной строки, без интервалов. Нажмите, чтобы включить интервалы.",
    spacedLayout: "Абзацы с интервалами. Нажмите, чтобы включить книжную вёрстку.",
    paragraphLayout: "Вёрстка абзацев",
    edit: "Правка (Ctrl+Shift+V)",
    preview: "Просмотр (Ctrl+Shift+V)",
    togglePreview: "Показать или скрыть просмотр",
    showToolbar: "Показать панель (Esc)",
    focusMode: "Режим фокусировки",
    toggleFocusMode: "Переключить режим фокусировки",
  },

  window: {
    minimize: "Свернуть",
    maximize: "Развернуть",
    close: "Закрыть",
  },

  document: {
    untitled: "Без названия.mari",
    nothingOpen: "Ничего не открыто",
    nothingOpenHint: "Откройте папку или файл, чтобы начать.",
    words: (n) => `${n} ${plural(n, "слово", "слова", "слов")}`,
    characters: (n) => `${n} ${plural(n, "символ", "символа", "символов")}`,
  },

  status: {
    saved: "Сохранено",
    savedHighlightsNeedMari: "Сохранено — для выделений нужен файл .mari",
    savedMarksNeedMari: "Сохранено — для пометок нужен файл .mari",
    exported: "Экспортировано",
    exportedHighlightsStay: "Экспортировано — выделения остаются в .mari",
    couldntSave: "Не удалось сохранить",
    couldntExport: "Не удалось экспортировать",
    couldntOpenFile: "Не удалось открыть файл",
    couldntOpenFolder: "Не удалось открыть папку",
    couldntCreateFile: "Не удалось создать файл",
    couldntCreateFolder: "Не удалось создать папку",
    couldntDelete: "Не удалось удалить",
    couldntKeepUnsaved: "Не удалось сохранить изменения на следующий раз",
    couldntReopen: (name) => `Не удалось снова открыть ${name}`,
    movedTo: (name) => `Перемещено в ${name}`,
    couldntMove: (name) => `Не удалось переместить ${name}`,
    fileChangedElsewhere: (name) =>
      `${name} изменён в другом месте — открыт файл с диска, несохранённая копия отброшена`,
    failure: (what, reason) => `${what} — ${reason}`,
  },

  dialog: {
    cancel: "Отмена",
    delete: "Удалить",
    dontAskAgain: "Больше не спрашивать",
    discard: "Не сохранять",
    discardTitle: "Отменить несохранённые изменения?",
    discardMessage: (name) =>
      `Изменения в файле ${name} не сохранены. Сначала сохраните их, если хотите оставить.`,
    deleteTitle: (name) => `Удалить ${name}?`,
    deleteFolderMessage: "Папка будет удалена вместе со всем содержимым. Это нельзя отменить.",
    deleteFileMessage: "Это нельзя отменить.",
  },

  sidebar: {
    newFile: "Новый файл",
    newFolder: "Новая папка",
    loading: "Загрузка…",
    couldntOpenFolder: "Не удалось открыть эту папку",
    folderGone: "Этой папки больше нет",
    emptyFolder: "Пустая папка",
    resize: "Изменить ширину боковой панели",
    dragToResize: "Потяните, чтобы изменить ширину — двойной щелчок вернёт исходную",
    filePlaceholder: "глава.mari",
    folderPlaceholder: "имя папки",
  },

  format: {
    label: "Форматирование",
    bold: "Полужирный",
    italic: "Курсив",
    strikethrough: "Зачёркнутый",
    heading: "Заголовок",
    subheading: "Подзаголовок",
    quote: "Цитата",
  },

  markdown: {
    cheatSheet: "Шпаргалка по Markdown",
    title: "Markdown",
    heading: "Заголовок",
    bold: "Полужирный",
    italic: "Курсив",
    quote: "Цитата",
    bulletList: "Маркированный список",
    numberedList: "Нумерованный список",
    link: "Ссылка",
    sceneBreak: "Разрыв сцены",
  },

  editor: {
    placeholder: "Начните писать…",
    copied: "Скопировано",
    copyChapter: "Скопировать всю главу",
    clearHighlight: "Убрать выделение",
    passageActions: "Действия с фрагментом",
    movePassage: "Переместить фрагмент",
    viewHistory: "История версий",
    draftRewrite: "Черновик правки",
    moveToDrawer: "Убрать фрагмент в ящик",
    addNote: "Добавить заметку",
    note: (text) => `Заметка: ${text}`,
    passageNote: "Заметка к фрагменту",
    notePlaceholder: "Что здесь нужно сделать?",
    repositioning: (preview) =>
      `Перемещение: «${preview}» — щёлкните там, где фрагмент должен оказаться, или нажмите Esc для отмены.`,
  },

  highlights: {
    good: "Хорошо",
    "ok-for-now": "Пока сойдёт",
    tweak: "Подправить",
    reposition: "Переставить",
    rewrite: "Переписать",
    expand: "Расширить",
    cut: "Вырезать",
    unsure: "Не уверен",
  },

  draft: {
    write: "Черновик правки",
    compare: "Сравнение",
    history: "История версий",
    resize: "Изменить ширину панели",
    dragToResize: "Потяните, чтобы изменить ширину — двойной щелчок вернёт исходную",
    close: "Закрыть",
    placeholder: "Напишите свой вариант здесь…",
    earlierVersions: (n) => `${n} ${plural(n, "предыдущая версия", "предыдущие версии", "предыдущих версий")}`,
    original: "Оригинал",
    draft: "Черновик",
    current: "Текущий вариант",
    afterwards: "После замены",
    noMark: "Без пометки",
    leaveMarked: (label) => `Оставить на фрагменте пометку «${label}»`,
    keepTweaking: "Продолжить правку",
    replace: "Заменить",
    backToList: "К списку",
    backToDraft: "К черновику",
    beforeMove: "До перемещения",
    selectedVersion: "Выбранная версия",
    restoreVersion: "Восстановить эту версию",
    movedBadge: "Перемещено",
    draftBadge: "Черновик",
  },

  drawer: {
    title: "Ящик",
    close: "Закрыть",
    empty: "Ящик пуст.",
    delete: "Удалить",
    deleteForGood: "Удалить навсегда",
    keepIt: "Оставить",
    copyText: "Скопировать текст",
    putBack: "Вернуть на место",
    wordCount: (n) => `${n} ${plural(n, "слово", "слова", "слов")}`,
  },

  chapter: {
    synopsis: "Содержание",
    synopsisPlaceholder: "Что происходит в этой главе?",
    plan: "План",
    planPlaceholder: "По одному пункту в строке",
    edit: "Изменить",
  },

  terminal: {
    title: "Терминал",
    clear: "Очистить",
    close: "Закрыть терминал",
  },

  search: {
    placeholder: "Найти в главе",
    noMatches: "совпадений нет",
    position: (current, total) => `${current} из ${total}`,
    found: (total) => `найдено: ${total}`,
    previous: "Предыдущее совпадение",
    next: "Следующее совпадение",
    close: "Закрыть поиск",
  },
};
