import { t, type LocaleId } from "./i18n.svelte";
import type { MariCut, MariSynopsis } from "./mariBundle";
import type { StoredHighlight } from "./highlightStore";
import type { ChunkVersion } from "./chunkHistory";

/**
 * The chapter Mari opens when there is nothing else to open.
 *
 * Mari's screen is empty until you have written something and marked it up,
 * which means the things it exists for — highlights, notes, the drawer, drafts
 * kept beside the prose — are invisible to anyone seeing it for the first
 * time. So a first run lands in a real chapter, already part-revised.
 *
 * The prose is the first chapter of Alice's Adventures in Wonderland, which is
 * long out of copyright. Every one of the eight marks covers a whole paragraph,
 * never a sentence: that is how the states are meant to be used, and a sample
 * that marked half-sentences would teach the wrong habit on sight.
 *
 * The prose stays in English in both languages. It is an English novel, and
 * the Russian translations that are any good are still in copyright. What does
 * change with the language is everything the writer wrote *about* it — the
 * synopsis, the plan, and the notes — which is the part being demonstrated.
 */

/**
 * The chapter itself. The marks below are offsets into this, before the
 * heading is put in front of it — that is added per language, and everything
 * shifts by however long it turns out to be.
 *
 * Paragraphs run on one line each. The source this came from was hard-wrapped
 * at about seventy characters, and those breaks are real characters: they
 * stopped every line of prose short of the column, which read as a chapter set
 * too narrow and left a centred heading looking pushed to the right.
 */
const PROSE =
  "Alice was beginning to get very tired of sitting by her sister on the bank, and of having nothing to do: once or twice she had peeped into the book her sister was reading, but it had no pictures or conversations in it, “and what is the use of a book,” thought Alice “without pictures or conversations?”\n\nSo she was considering in her own mind (as well as she could, for the hot day made her feel very sleepy and stupid), whether the pleasure of making a daisy-chain would be worth the trouble of getting up and picking the daisies, when suddenly a White Rabbit with pink eyes ran close by her.\n\nThere was nothing so _very_ remarkable in that; nor did Alice think it so _very_ much out of the way to hear the Rabbit say to itself, “Oh dear! Oh dear! I shall be late!” (when she thought it over afterwards, it occurred to her that she ought to have wondered at this, but at the time it all seemed quite natural); but when the Rabbit actually _took a watch out of its waistcoat-pocket_, and looked at it, and then hurried on, Alice started to her feet, for it flashed across her mind that she had never before seen a rabbit with either a waistcoat-pocket, or a watch to take out of it, and burning with curiosity, she ran across the field after it, and fortunately was just in time to see it pop down a large rabbit-hole under the hedge.\n\nIn another moment down went Alice after it, never once considering how in the world she was to get out again.\n\nThe rabbit-hole went straight on like a tunnel for some way, and then dipped suddenly down, so suddenly that Alice had not a moment to think about stopping herself before she found herself falling down a very deep well.\n\nEither the well was very deep, or she fell very slowly, for she had plenty of time as she went down to look about her and to wonder what was going to happen next. First, she tried to look down and make out what she was coming to, but it was too dark to see anything; then she looked at the sides of the well, and noticed that they were filled with cupboards and book-shelves; here and there she saw maps and pictures hung upon pegs. She took down a jar from one of the shelves as she passed; it was labelled “ORANGE MARMALADE”, but to her great disappointment it was empty: she did not like to drop the jar for fear of killing somebody underneath, so managed to put it into one of the cupboards as she fell past it.\n\nDown, down, down. Would the fall _never_ come to an end? “I wonder how many miles I’ve fallen by this time?” she said aloud. “I must be getting somewhere near the centre of the earth. Let me see: that would be four thousand miles down, I think—” (for, you see, Alice had learnt several things of this sort in her lessons in the schoolroom, and though this was not a _very_ good opportunity for showing off her knowledge, as there was no one to listen to her, still it was good practice to say it over) “—yes, that’s about the right distance—but then I wonder what Latitude or Longitude I’ve got to?” (Alice had no idea what Latitude was, or Longitude either, but thought they were nice grand words to say.)\n\nPresently she began again. “I wonder if I shall fall right _through_ the earth! How funny it’ll seem to come out among the people that walk with their heads downward! The Antipathies, I think—” (she was rather glad there _was_ no one listening, this time, as it didn’t sound at all the right word) “—but I shall have to ask them what the name of the country is, you know. Please, Ma’am, is this New Zealand or Australia?” (and she tried to curtsey as she spoke—fancy _curtseying_ as you’re falling through the air! Do you think you could manage it?) “And what an ignorant little girl she’ll think me for asking! No, it’ll never do to ask: perhaps I shall see it written up somewhere.”\n\nDown, down, down. There was nothing else to do, so Alice soon began talking again. “Dinah’ll miss me very much to-night, I should think!” (Dinah was the cat.) “I hope they’ll remember her saucer of milk at tea-time. Dinah my dear! I wish you were down here with me! There are no mice in the air, I’m afraid, but you might catch a bat, and that’s very like a mouse, you know. But do cats eat bats, I wonder?” And here Alice began to get rather sleepy, and went on saying to herself, in a dreamy sort of way, “Do cats eat bats? Do cats eat bats?” and sometimes, “Do bats eat cats?” for, you see, as she couldn’t answer either question, it didn’t much matter which way she put it. She felt that she was dozing off, and had just begun to dream that she was walking hand in hand with Dinah, and saying to her very earnestly, “Now, Dinah, tell me the truth: did you ever eat a bat?” when suddenly, thump! thump! down she came upon a heap of sticks and dry leaves, and the fall was over.\n\nAlice was not a bit hurt, and she jumped up on to her feet in a moment: she looked up, but it was all dark overhead; before her was another long passage, and the White Rabbit was still in sight, hurrying down it. There was not a moment to be lost: away went Alice like the wind, and was just in time to hear it say, as it turned a corner, “Oh my ears and whiskers, how late it’s getting!” She was close behind it when she turned the corner, but the Rabbit was no longer to be seen: she found herself in a long, low hall, which was lit up by a row of lamps hanging from the roof.\n\nThere were doors all round the hall, but they were all locked; and when Alice had been all the way down one side and up the other, trying every door, she walked sadly down the middle, wondering how she was ever to get out again.\n\nSuddenly she came upon a little three-legged table, all made of solid glass; there was nothing on it except a tiny golden key, and Alice’s first thought was that it might belong to one of the doors of the hall; but, alas! either the locks were too large, or the key was too small, but at any rate it would not open any of them. However, on the second time round, she came upon a low curtain she had not noticed before, and behind it was a little door about fifteen inches high: she tried the little golden key in the lock, and to her great delight it fitted!\n\nAlice opened the door and found that it led into a small passage, not much larger than a rat-hole: she knelt down and looked along the passage into the loveliest garden you ever saw. How she longed to get out of that dark hall, and wander about among those beds of bright flowers and those cool fountains, but she could not even get her head through the doorway; “and even if my head would go through,” thought poor Alice, “it would be of very little use without my shoulders. Oh, how I wish I could shut up like a telescope! I think I could, if I only knew how to begin.” For, you see, so many out-of-the-way things had happened lately, that Alice had begun to think that very few things indeed were really impossible.\n\nThere seemed to be no use in waiting by the little door, so she went back to the table, half hoping she might find another key on it, or at any rate a book of rules for shutting people up like telescopes: this time she found a little bottle on it, (“which certainly was not here before,” said Alice,) and round the neck of the bottle was a paper label, with the words “DRINK ME,” beautifully printed on it in large letters.\n\nIt was all very well to say “Drink me,” but the wise little Alice was not going to do _that_ in a hurry. “No, I’ll look first,” she said, “and see whether it’s marked ‘_poison_’ or not”; for she had read several nice little histories about children who had got burnt, and eaten up by wild beasts and other unpleasant things, all because they _would_ not remember the simple rules their friends had taught them: such as, that a red-hot poker will burn you if you hold it too long; and that if you cut your finger _very_ deeply with a knife, it usually bleeds; and she had never forgotten that, if you drink much from a bottle marked “poison,” it is almost certain to disagree with you, sooner or later.\n\nHowever, this bottle was _not_ marked “poison,” so Alice ventured to taste it, and finding it very nice, (it had, in fact, a sort of mixed flavour of cherry-tart, custard, pine-apple, roast turkey, toffee, and hot buttered toast,) she very soon finished it off.\n\n*      *      *      *      *      *      *\n\n    *      *      *      *      *      *\n\n*      *      *      *      *      *      *\n\n“What a curious feeling!” said Alice; “I must be shutting up like a telescope.”\n\nAnd so it was indeed: she was now only ten inches high, and her face brightened up at the thought that she was now the right size for going through the little door into that lovely garden. First, however, she waited for a few minutes to see if she was going to shrink any further: she felt a little nervous about this; “for it might end, you know,” said Alice to herself, “in my going out altogether, like a candle. I wonder what I should be like then?” And she tried to fancy what the flame of a candle is like after the candle is blown out, for she could not remember ever having seen such a thing.\n\nAfter a while, finding that nothing more happened, she decided on going into the garden at once; but, alas for poor Alice! when she got to the door, she found she had forgotten the little golden key, and when she went back to the table for it, she found she could not possibly reach it: she could see it quite plainly through the glass, and she tried her best to climb up one of the legs of the table, but it was too slippery; and when she had tired herself out with trying, the poor little thing sat down and cried.\n\nSoon her eye fell on a little glass box that was lying under the table: she opened it, and found in it a very small cake, on which the words “EAT ME” were beautifully marked in currants. “Well, I’ll eat it,” said Alice, “and if it makes me grow larger, I can reach the key; and if it makes me grow smaller, I can creep under the door; so either way I’ll get into the garden, and I don’t care which happens!”\n\nShe ate a little bit, and said anxiously to herself, “Which way? Which way?”, holding her hand on the top of her head to feel which way it was growing, and she was quite surprised to find that she remained the same size: to be sure, this generally happens when one eats cake, but Alice had got so much into the way of expecting nothing but out-of-the-way things to happen, that it seemed quite dull and stupid for life to go on in the common way.\n\nSo she set to work, and very soon finished off the cake.\n\n*      *      *      *      *      *      *\n\n    *      *      *      *      *      *\n\n*      *      *      *      *      *      *";

const FILE_NAME = "Down the Rabbit-Hole.mari";

/** Whole paragraphs, one per state. There is a test that they stay whole. */
const MARKS: StoredHighlight[] = [
  {
    from: 0,
    to: 302,
    stateId: "ok-for-now",
    id: "27caac44-9e39-49fb-8596-4502132e4dcd",
  },
  {
    from: 595,
    to: 1334,
    stateId: "good",
    id: "01ac93fd-8613-4109-b454-0c5f363b3062",
  },
  {
    from: 1668,
    to: 2383,
    stateId: "rewrite",
    id: "9a6ab8b7-d583-41ba-824f-19c71c059717",
  },
  {
    from: 2385,
    to: 3091,
    stateId: "expand",
    id: "bd71bb70-6637-4a00-bb11-5f7b3211c17e",
  },
  {
    from: 3093,
    to: 3777,
    stateId: "cut",
    id: "cc38df22-ffd2-485f-ac11-775abade2aa8",
  },
  {
    from: 3779,
    to: 4759,
    stateId: "reposition",
    id: "94b65fae-7862-4b98-9af3-6bac9653e7fa",
  },
  {
    from: 7277,
    to: 7978,
    stateId: "unsure",
    id: "270fb5df-1774-4ab5-aa76-b64b16b8f02d",
  },
  {
    from: 8375,
    to: 8454,
    stateId: "tweak",
    id: "8ed55bdb-8b9f-42d1-b2f9-e0fc9fcb2675",
  },
];

const KEPT_DRAFTS: Record<string, ChunkVersion[]> = {
  "8ed55bdb-8b9f-42d1-b2f9-e0fc9fcb2675": [
    {
      id: "df15910f-98aa-4a34-bdd4-0118f32ed464",
      text: "“What a curious feeling!” said Alice; “I must be shutting up like a spy-glass.”",
      createdAt: "2026-04-07T10:30:00Z",
      kind: "draft",
    },
  ],
};

/** The drawer: passages taken out of the chapter but not thrown away. */
const DRAWER: MariCut[] = [
  {
    id: "cut-b8fc013b",
    text: "“Well!” thought Alice to herself, “after such a fall as this, I shall think nothing of tumbling down stairs! How brave they’ll all think me at home! Why, I wouldn’t say anything about it, even if I fell off the top of the house!” (Which was very likely true.)",
    cutAt: "2026-04-10T10:30:00Z",
    before: "d to put it into one of the cupboards as she fell past it.\n\n",
    after: "\n\nDown, down, down. Would the fall _never_ come to an end? “",
  },
  {
    id: "cut-70ec138f",
    text: "“Come, there’s no use in crying like that!” said Alice to herself, rather sharply; “I advise you to leave off this minute!” She generally gave herself very good advice, (though she very seldom followed it), and sometimes she scolded herself so severely as to bring tears into her eyes; and once she remembered trying to box her own ears for having cheated herself in a game of croquet she was playing against herself, for this curious child was very fond of pretending to be two people. “But it’s no use now,” thought poor Alice, “to pretend to be two people! Why, there’s hardly enough of me left to make _one_ respectable person!”",
    cutAt: "2026-04-10T10:30:00Z",
    before: "out with trying, the poor little thing sat down and cried.\n\n",
    after: "\n\nSoon her eye fell on a little glass box that was lying und",
  },
];

interface Annotations {
  synopsis: string;
  plan: string[];
  /** Keyed by mark id. */
  notes: Record<string, string>;
  /** Keyed by drawer id. */
  cutNotes: Record<string, string>;
}

const ANNOTATIONS: Record<LocaleId, Annotations> = {
  en: {
    synopsis:
      "Alice follows the White Rabbit down the hole and lands in the hall of doors.",
    plan: [
      "Establish the boredom on the bank",
      "The Rabbit: make the waistcoat land",
      "The fall, stretched out, let her ramble",
      "Hall of doors, the garden glimpsed",
      "Drink me, and the size problem begins",
    ],
    notes: {
      "27caac44-9e39-49fb-8596-4502132e4dcd":
        "Serviceable. Come back to the opening last, once I know what the chapter is.",
      "01ac93fd-8613-4109-b454-0c5f363b3062":
        "This is the hook. Don't touch a word of it.",
      "9a6ab8b7-d583-41ba-824f-19c71c059717":
        "Too much inventory. Cut to the two things she actually notices.",
      "bd71bb70-6637-4a00-bb11-5f7b3211c17e":
        "The fall should feel longer than it currently reads. Stretch it.",
      "94b65fae-7862-4b98-9af3-6bac9653e7fa":
        "The Dinah thread is good but it belongs after she lands.",
      "270fb5df-1774-4ab5-aa76-b64b16b8f02d":
        "Not sure the poison aside earns its length. Decide on the next pass.",
      "8ed55bdb-8b9f-42d1-b2f9-e0fc9fcb2675":
        "Telescope appears twice within a page. Lose one of them.",
    },
    cutNotes: {
      "cut-b8fc013b":
        "The joke lands, but it stalls the fall right where it should be picking up speed.",
      "cut-70ec138f":
        "She scolds herself twice in this chapter. Keeping the later one.",
    },
  },
  ru: {
    synopsis:
      "Алиса идёт за Белым Кроликом в нору и оказывается в зале с дверями.",
    plan: [
      "Показать скуку на берегу",
      "Кролик: жилет должен запомниться",
      "Падение растянуть, дать ей поболтать",
      "Зал с дверями, сад мельком",
      "«Выпей меня» — и начинается история с размером",
    ],
    notes: {
      "27caac44-9e39-49fb-8596-4502132e4dcd":
        "Сойдёт. Вернуться к началу в последнюю очередь, когда станет ясно, о чём глава.",
      "01ac93fd-8613-4109-b454-0c5f363b3062":
        "Вот крючок. Не трогать ни слова.",
      "9a6ab8b7-d583-41ba-824f-19c71c059717":
        "Слишком много перечисления. Оставить те две вещи, которые она правда замечает.",
      "bd71bb70-6637-4a00-bb11-5f7b3211c17e":
        "Падение должно читаться дольше, чем сейчас. Растянуть.",
      "94b65fae-7862-4b98-9af3-6bac9653e7fa":
        "Линия с Диной хороша, но её место после приземления.",
      "270fb5df-1774-4ab5-aa76-b64b16b8f02d":
        "Не уверен, что отступление про яд стоит такой длины. Решить на следующем проходе.",
      "8ed55bdb-8b9f-42d1-b2f9-e0fc9fcb2675":
        "Подзорная труба встречается дважды на страницу. Одну убрать.",
    },
    cutNotes: {
      "cut-b8fc013b":
        "Шутка работает, но тормозит падение ровно там, где оно должно разгоняться.",
      "cut-70ec138f": "Она отчитывает себя дважды за главу. Оставляю вторую.",
    },
  },
  de: {
    synopsis:
      "Alice folgt dem weißen Kaninchen in den Bau und landet im Saal der Türen.",
    plan: [
      "Die Langeweile am Ufer aufbauen",
      "Das Kaninchen: die Westentasche muss sitzen",
      "Der Fall, in die Länge gezogen, sie reden lassen",
      "Saal der Türen, ein Blick in den Garten",
      "„Trink mich“, und das Problem mit der Größe beginnt",
    ],
    notes: {
      "27caac44-9e39-49fb-8596-4502132e4dcd":
        "Brauchbar. Den Anfang zuletzt überarbeiten, wenn klar ist, worum es im Kapitel geht.",
      "01ac93fd-8613-4109-b454-0c5f363b3062":
        "Das ist der Haken. Kein Wort daran ändern.",
      "9a6ab8b7-d583-41ba-824f-19c71c059717":
        "Zu viel Aufzählung. Auf die zwei Dinge kürzen, die ihr wirklich auffallen.",
      "bd71bb70-6637-4a00-bb11-5f7b3211c17e":
        "Der Fall sollte sich länger anfühlen, als er sich liest. Dehnen.",
      "94b65fae-7862-4b98-9af3-6bac9653e7fa":
        "Der Strang mit Dina ist gut, gehört aber hinter die Landung.",
      "270fb5df-1774-4ab5-aa76-b64b16b8f02d":
        "Nicht sicher, ob der Einschub über das Gift seine Länge wert ist. Beim nächsten Durchgang entscheiden.",
      "8ed55bdb-8b9f-42d1-b2f9-e0fc9fcb2675":
        "Das Fernrohr kommt zweimal auf einer Seite vor. Eines streichen.",
    },
    cutNotes: {
      "cut-b8fc013b":
        "Der Witz sitzt, bremst den Fall aber genau da, wo er Fahrt aufnehmen sollte.",
      "cut-70ec138f":
        "Sie schilt sich zweimal in diesem Kapitel. Die zweite Stelle bleibt.",
    },
  },
  es: {
    synopsis:
      "Alicia sigue al Conejo Blanco por la madriguera y acaba en la sala de las puertas.",
    plan: [
      "Dejar clara la modorra en la orilla",
      "El Conejo: que el chaleco se note",
      "La caída, estirada, dejarla divagar",
      "La sala de las puertas, el jardín entrevisto",
      "«Bébeme», y empieza el problema del tamaño",
    ],
    notes: {
      "27caac44-9e39-49fb-8596-4502132e4dcd":
        "Pasable. Volver al principio al final, cuando sepa de qué va el capítulo.",
      "01ac93fd-8613-4109-b454-0c5f363b3062":
        "Este es el anzuelo. No tocar ni una palabra.",
      "9a6ab8b7-d583-41ba-824f-19c71c059717":
        "Demasiado inventario. Dejar solo las dos cosas en que de verdad se fija.",
      "bd71bb70-6637-4a00-bb11-5f7b3211c17e":
        "La caída debería sentirse más larga de lo que se lee. Estirarla.",
      "94b65fae-7862-4b98-9af3-6bac9653e7fa":
        "El hilo de Dina está bien, pero va después de que aterrice.",
      "270fb5df-1774-4ab5-aa76-b64b16b8f02d":
        "No sé si el inciso del veneno merece esa extensión. Decidirlo en la próxima pasada.",
      "8ed55bdb-8b9f-42d1-b2f9-e0fc9fcb2675":
        "El catalejo sale dos veces en una página. Quitar uno.",
    },
    cutNotes: {
      "cut-b8fc013b":
        "El chiste funciona, pero frena la caída justo donde debería coger velocidad.",
      "cut-70ec138f":
        "Se regaña dos veces en este capítulo. Me quedo con la segunda.",
    },
  },
  zh: {
    synopsis: "爱丽丝跟着白兔钻进洞里，落到了那间满是门的大厅。",
    plan: [
      "先把河岸上的百无聊赖写出来",
      "白兔：那件背心要让人记住",
      "把下落拉长，让她一路胡思乱想",
      "满是门的大厅，花园惊鸿一瞥",
      "「喝我」，身材的麻烦就此开始",
    ],
    notes: {
      "27caac44-9e39-49fb-8596-4502132e4dcd":
        "还行。等弄清这一章到底写什么，最后再回头改开头。",
      "01ac93fd-8613-4109-b454-0c5f363b3062": "这是钩子。一个字都别动。",
      "9a6ab8b7-d583-41ba-824f-19c71c059717":
        "罗列太多。只留下她真正注意到的那两样。",
      "bd71bb70-6637-4a00-bb11-5f7b3211c17e":
        "下落读起来应该比现在更久。拉长。",
      "94b65fae-7862-4b98-9af3-6bac9653e7fa":
        "黛娜那条线写得好，但该放在她落地之后。",
      "270fb5df-1774-4ab5-aa76-b64b16b8f02d":
        "关于毒药的那段插话值不值这么长，没把握。下一遍再定。",
      "8ed55bdb-8b9f-42d1-b2f9-e0fc9fcb2675":
        "望远镜一页之内出现了两次。删掉一个。",
    },
    cutNotes: {
      "cut-b8fc013b":
        "这个玩笑是有效的，可它恰好在下落该加速的地方把节奏拖住了。",
      "cut-70ec138f": "这一章里她训了自己两回。留后面那回。",
    },
  },
};

/** Which plan beats are already ticked off. */
const PLAN_DONE: boolean[] = [true, true, true, false, false];

export interface SampleChapter {
  fileName: string;
  text: string;
  highlights: StoredHighlight[];
  notes: Record<string, string>;
  history: Record<string, ChunkVersion[]>;
  synopsis: MariSynopsis;
  cuts: MariCut[];
}

export function sampleChapter(locale: LocaleId): SampleChapter {
  const said = ANNOTATIONS[locale] ?? ANNOTATIONS.en;
  // A heading of its own, so what opens says what it is. Every mark moves down
  // the page by exactly its length.
  const heading = `# ${t().document.sampleHeading}\n\n`;
  return {
    fileName: FILE_NAME,
    text: heading + PROSE,
    highlights: MARKS.map((mark) => ({
      ...mark,
      from: mark.from + heading.length,
      to: mark.to + heading.length,
    })),
    notes: { ...said.notes },
    history: KEPT_DRAFTS,
    synopsis: {
      text: said.synopsis,
      plan: said.plan.map((text, i) => ({ text, done: PLAN_DONE[i] ?? false })),
    },
    cuts: DRAWER.map((cut) => ({ ...cut, note: said.cutNotes[cut.id] })),
  };
}
