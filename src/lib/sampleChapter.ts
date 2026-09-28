import type { LocaleId } from "./i18n.svelte";
import type { MariCut, MariSynopsis } from "./mariBundle";
import type { StoredHighlight } from "./highlightStore";
import type { ChunkVersion } from "./chunkHistory";

/**
 * A chapter to open when there's nothing else.
 *
 * Mari's own screen is empty until you have written something and marked it
 * up, which means the things it exists for — highlights, notes, the drawer,
 * drafts kept beside the prose — are invisible to anyone seeing it for the
 * first time. This is a short scene already revised, so all of that is on
 * screen in the first ten seconds.
 *
 * A scene rather than a tour: the marks and notes are the kind a writer would
 * actually leave themselves, which shows the app in use rather than describing
 * it. It opens unsaved and belongs to nobody, so it can be read, pulled apart
 * and thrown away without touching a file.
 */

/** A marked passage, located by its words rather than by an offset. */
interface SampleMark {
  /** Must appear exactly once in the text — there's a test for that. */
  phrase: string;
  stateId: string;
  note?: string;
  /** An earlier wording, kept the way a replaced draft is kept. */
  earlier?: string;
}

interface SampleText {
  fileName: string;
  text: string;
  synopsis: string;
  plan: string[];
  marks: SampleMark[];
  drawer: { text: string; note: string };
}

const EN: SampleText = {
  fileName: "A sample chapter.mari",
  text: `The last train had gone an hour ago and Ilya had watched it go.

He sat on the bench with his coat buttoned to the throat and his bag between his feet, and he did not move, and the station did not ask him to.

The lamps came on one at a time down the length of the platform, the way they always did, as if each one had to be persuaded.

A woman in a red coat came out of the waiting room, looked at the empty track, and looked at him. She had the face of someone about to ask a question she already knew the answer to.

"You've missed it," she said.

"I have."

"There's another at six."

He nodded, and did not say that he had no intention of being on it.`,
  synopsis: "Ilya misses the last train on purpose, and tells nobody.",
  plan: [
    "Put him on the platform after the train has gone",
    "Let the woman ask the question he is avoiding",
    "End before he admits anything out loud",
  ],
  marks: [
    {
      phrase: "The last train had gone an hour ago and Ilya had watched it go.",
      stateId: "good",
      note: "Keep. The whole chapter is in this line.",
    },
    {
      phrase: "and he did not move, and the station did not ask him to",
      stateId: "tweak",
      note: "The rhythm stumbles on the second 'and'. Try a full stop.",
    },
    { phrase: "as if each one had to be persuaded", stateId: "good" },
    {
      phrase: "She had the face of someone about to ask a question she already knew the answer to.",
      stateId: "rewrite",
      note: "Too pleased with itself. Say less.",
      earlier: "She looked like she was going to ask him something obvious.",
    },
    { phrase: '"There\'s another at six."', stateId: "unsure" },
    {
      phrase: "He nodded, and did not say that he had no intention of being on it.",
      stateId: "expand",
      note: "This is the moment. It deserves more room than one sentence.",
    },
  ],
  drawer: {
    text: "The tea from the machine was undrinkable and he drank it anyway, twice.",
    note: "Good line, wrong chapter.",
  },
};

const RU: SampleText = {
  fileName: "Пример главы.mari",
  text: `Последний поезд ушёл час назад, и Илья смотрел, как он уходит.

Он сидел на скамейке, застегнув пальто до горла, сумка стояла между ботинок, и он не двигался, и вокзал ни о чём его не просил.

Фонари зажигались по одному вдоль всей платформы, как всегда, будто каждый приходилось уговаривать.

Женщина в красном пальто вышла из зала ожидания, посмотрела на пустой путь и посмотрела на него. У неё было лицо человека, который собирается задать вопрос, зная ответ.

— Опоздали, — сказала она.

— Опоздал.

— В шесть будет ещё один.

Он кивнул и не сказал, что садиться на него не собирается.`,
  synopsis: "Илья нарочно опаздывает на последний поезд и никому об этом не говорит.",
  plan: [
    "Оставить его на платформе, когда поезд уже ушёл",
    "Пусть женщина задаст вопрос, которого он избегает",
    "Закончить до того, как он признается вслух",
  ],
  marks: [
    {
      phrase: "Последний поезд ушёл час назад, и Илья смотрел, как он уходит.",
      stateId: "good",
      note: "Оставить. В этой строке вся глава.",
    },
    {
      phrase: "и он не двигался, и вокзал ни о чём его не просил",
      stateId: "tweak",
      note: "Ритм спотыкается на втором «и». Попробовать точку.",
    },
    { phrase: "будто каждый приходилось уговаривать", stateId: "good" },
    {
      phrase: "У неё было лицо человека, который собирается задать вопрос, зная ответ.",
      stateId: "rewrite",
      note: "Слишком довольна собой. Сказать меньше.",
      earlier: "Было видно, что она сейчас спросит что-то очевидное.",
    },
    { phrase: "— В шесть будет ещё один.", stateId: "unsure" },
    {
      phrase: "Он кивнул и не сказал, что садиться на него не собирается.",
      stateId: "expand",
      note: "Вот этот момент. Одного предложения ему мало.",
    },
  ],
  drawer: {
    text: "Чай из автомата был отвратительный, и он выпил его дважды.",
    note: "Хорошая фраза, не та глава.",
  },
};

const TEXTS: Record<LocaleId, SampleText> = { en: EN, ru: RU };

/** Everything a `.mari` bundle holds, ready to open. */
export interface SampleChapter {
  fileName: string;
  text: string;
  highlights: StoredHighlight[];
  notes: Record<string, string>;
  history: Record<string, ChunkVersion[]>;
  synopsis: MariSynopsis;
  cuts: MariCut[];
}

/**
 * Ids are fixed rather than generated so the sample is the same every time it
 * is opened, which is what lets a test check it rather than watch it change.
 */
function markId(index: number): string {
  return `sample-mark-${index}`;
}

/** The timestamp on the sample's kept versions. Fixed, for the same reason. */
const WHEN = "2026-01-01T09:00:00.000Z";

export function sampleChapter(locale: LocaleId): SampleChapter {
  const source = TEXTS[locale] ?? EN;
  const highlights: StoredHighlight[] = [];
  const notes: Record<string, string> = {};
  const history: Record<string, ChunkVersion[]> = {};

  source.marks.forEach((mark, index) => {
    const from = source.text.indexOf(mark.phrase);
    // A phrase that has drifted out of the text is skipped rather than thrown:
    // a sample that won't open is worse than one missing a colour.
    if (from < 0) return;
    const id = markId(index);
    highlights.push({ from, to: from + mark.phrase.length, stateId: mark.stateId, id });
    if (mark.note) notes[id] = mark.note;
    if (mark.earlier) {
      history[id] = [{ id: `${id}-v1`, text: mark.earlier, createdAt: WHEN, kind: "draft" }];
    }
  });

  return {
    fileName: source.fileName,
    text: source.text,
    highlights,
    notes,
    history,
    synopsis: { text: source.synopsis, plan: source.plan.map((text) => ({ text, done: false })) },
    cuts: [
      {
        id: "sample-cut-1",
        text: source.drawer.text,
        cutAt: WHEN,
        note: source.drawer.note,
      },
    ],
  };
}
