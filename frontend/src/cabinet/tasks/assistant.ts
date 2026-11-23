import { canGenerate, makeAnalogs, seededRandom } from "./analogs";
import { bankTasks } from "./bank";
import { examOf, subjectOf } from "./catalog";
import { isAutoChecked } from "./check";
import { DRAFT_LIMIT } from "./draft";
import type { Difficulty, ExamId, SubjectId, TaskItem } from "./types";

/**
 * ИИ-помощник раздела «Задания» (TASKS-3). Функции: подбор из банка, аналоги с проверкой ответа,
 * правка черновика командами, работа над ошибками ученика, проверка черновика для теста.
 * Ограничения: ничего не выдаёт сам — только меняет черновик; аналоги генерирует лишь для вычислимых
 * предметов; учебные темы — остальное вежливо отклоняет. В демо ответы строятся правилами без сети.
 */

export type AssistantParams = { subject: SubjectId; exam: ExamId | null; difficulty: Difficulty | null; count: number };

/** Ошибки ученика для «работы над ошибками»: темы и номера. Имя в запрос к модели не уходит. */
export type StudentWeakness = { name: string; topics: string[]; numbers: number[] };

export type AssistantContext = { params: AssistantParams; draft: TaskItem[]; seed: number; students: StudentWeakness[] };

export type AssistantReply =
  | { kind: "draft"; text: string; items: TaskItem[] }
  | { kind: "info"; text: string }
  | { kind: "refused"; text: string };

const MAX_COUNT = 20;

const wordsOf = (value: string) => value.toLowerCase().replace(/ё/g, "е");

function numberIn(request: string): number | null {
  const match = request.match(/(?:№|номер|задани[ея]\s*)\s*(\d{1,2})/i);
  return match ? Number(match[1]) : null;
}

function countIn(request: string, fallback: number): number {
  const match = request.match(/(\d{1,2})\s*(?:задач|задани|штук|шт|аналог|вопрос|карточ)/i);
  return Math.min(MAX_COUNT, match ? Number(match[1]) : fallback);
}

const stem = (word: string) => word.slice(0, Math.max(5, word.length - 3));
/** Общие слова в названиях тем — по ним тему не узнать («Прикладные задачи», «Задача с решением»). */
const GENERIC = /^(задач|решени|развер|ответ|анализ)/;

/** Задачи банка, тема которых упомянута в запросе: «вероятность», «логарифм», «ударения»… */
function topicMatches(request: string, task: TaskItem): boolean {
  const text = wordsOf(request);
  return wordsOf(task.topic)
    .split(/\s+/)
    .filter((word) => word.length >= 5 && !GENERIC.test(word))
    .some((word) => text.includes(stem(word)));
}

function inScope(task: TaskItem, params: AssistantParams): boolean {
  return task.subject === params.subject && (params.exam === null || task.exam === params.exam);
}

const DRAFT_FULL = `В черновике уже ${DRAFT_LIMIT} задач — это максимум. Уберите лишние или сохраните черновик.`;

function room(draft: TaskItem[]): number {
  return DRAFT_LIMIT - draft.length;
}

function analogsFor(base: TaskItem | undefined, count: number, seed: number): TaskItem[] {
  return base && canGenerate(base) ? makeAnalogs(base, count, seed) : [];
}

function pickTasks(params: AssistantParams, draft: TaskItem[], filter: (task: TaskItem) => boolean, count: number, seed: number): TaskItem[] {
  const used = new Set(draft.map((task) => task.id));
  const random = seededRandom(seed);
  const pool = bankTasks.filter((task) => inScope(task, params) && !used.has(task.id) && filter(task) && (params.difficulty === null || task.difficulty === params.difficulty));
  const shuffled = [...pool].sort(() => random() - 0.5);
  const fromBank = shuffled.slice(0, count);
  // Не хватило банка — добираем аналогами (если предмет вычислимый).
  const missing = count - fromBank.length;
  const base = fromBank.find(canGenerate) ?? pool.find(canGenerate) ?? bankTasks.find((task) => inScope(task, params) && filter(task) && canGenerate(task));
  return missing > 0 ? [...fromBank, ...analogsFor(base, missing, seed)] : fromBank;
}

/** Замена задачи: другая задача банка того же номера, а если их нет — аналог (для вычислимых). */
export function replacementFor(target: TaskItem, draft: TaskItem[], seed: number): TaskItem | undefined {
  const used = new Set(draft.map((task) => task.id));
  return bankTasks.find((task) => task.exam === target.exam && task.number === target.number && task.subject === target.subject && !used.has(task.id)) ?? analogsFor(target, 1, seed)[0];
}

const scopeLabel = (params: AssistantParams) => [subjectOf(params.subject).label, examOf(params.exam ?? undefined)?.label].filter(Boolean).join(" · ");

const plural = (count: number, forms: [string, string, string]) => {
  const lastTwo = count % 100;
  const last = count % 10;
  if (lastTwo > 10 && lastTwo < 20) return forms[2];
  if (last === 1) return forms[0];
  return last >= 2 && last <= 4 ? forms[1] : forms[2];
};
const tasksWord = (count: number) => `${count} ${plural(count, ["задачу", "задачи", "задач"])}`;

const EDU_WORDS = /задач|задани|тест|вариант|егэ|огэ|номер|№|аналог|уравнен|вероятн|ошибк|тем[аыу]|сложн|прощ|замени|перемешай|добав|подбер|урок|домашк|разбор|решени|ударен|паронимы|граммат|физик|информат|обществ|английск|русск|математ|очист/i;

export function respond(request: string, context: AssistantContext): AssistantReply {
  const { params, draft, seed } = context;
  const text = wordsOf(request.trim());
  if (!text) return { kind: "info", text: "Опишите, что собрать: например, «5 заданий на ударения, как №4»." };
  if (!EDU_WORDS.test(text)) {
    return { kind: "refused", text: "Я помогаю только с заданиями: подобрать задачи из банка, сделать аналоги, поправить черновик, собрать работу над ошибками. С остальным, к сожалению, не помогу." };
  }

  if (/очист/.test(text)) return { kind: "draft", text: "Черновик очищен.", items: [] };

  if (/перемешай/.test(text)) {
    const random = seededRandom(seed);
    return { kind: "draft", text: "Перемешала задачи в черновике.", items: [...draft].sort(() => random() - 0.5) };
  }

  if (/тест/.test(text) && !/подбер|добав|сделай \d/.test(text)) {
    const bad = draft.map((task, index) => ({ task, index })).filter(({ task }) => !isAutoChecked(task));
    if (draft.length === 0) return { kind: "info", text: "Черновик пуст — сначала добавьте задачи." };
    if (bad.length === 0) return { kind: "info", text: `Все ${tasksWord(draft.length)} проверяются автоматически — черновик можно сохранить как тест.` };
    const list = bad.map(({ task, index }) => `${index + 1}${task.answer.kind === "extended" ? " (развёрнутый ответ)" : " (ответ не проверен)"}`).join(", ");
    return { kind: "info", text: `В тест подойдут ${draft.length - bad.length} из ${draft.length}. Не подойдут задачи ${list} — их проверяет репетитор. При сохранении теста предложу их убрать.` };
  }

  const replace = text.match(/замени\s*(?:задачу\s*)?№?\s*(\d{1,2})/);
  if (replace) {
    const position = Number(replace[1]);
    const target = draft[position - 1];
    if (!target) return { kind: "info", text: `В черновике нет задачи №${position}.` };
    const swap = replacementFor(target, draft, seed);
    if (!swap) return { kind: "info", text: `Для задачи №${position} замены в банке пока нет.` };
    return { kind: "draft", text: `Заменила задачу №${position}: ${swap.source === "ai" ? "аналог с новыми числами, ответ проверен вычислением" : swap.sourceLabel}.`, items: draft.map((task, index) => (index === position - 1 ? swap : task)) };
  }

  if (/сложн|прощ|легч/.test(text) && !/подбер|добав/.test(text)) {
    const delta = /сложн/.test(text) ? 1 : -1;
    const used = new Set(draft.map((task) => task.id));
    let changed = 0;
    const items = draft.map((task) => {
      const swap = bankTasks.find((other) => other.exam === task.exam && other.number === task.number && other.difficulty === task.difficulty + delta && !used.has(other.id));
      if (!swap) return task;
      used.add(swap.id);
      changed += 1;
      return swap;
    });
    if (changed === 0) return { kind: "info", text: `В банке нет задач ${delta > 0 ? "сложнее" : "проще"} для этих номеров. Попробуйте «добавь 3 задачи сложности 3».` };
    return { kind: "draft", text: `Заменила ${tasksWord(changed)} на ${delta > 0 ? "более сложные" : "более простые"} того же номера.`, items };
  }

  const student = context.students.find((item) => text.includes(wordsOf(item.name.split(" ")[0] ?? "")));
  if (/ошибк/.test(text) || student) {
    if (!student) return { kind: "info", text: "Напишите имя ученика: например, «работа над ошибками Александра»." };
    if (room(draft) <= 0) return { kind: "info", text: DRAFT_FULL };
    const count = Math.min(countIn(request, params.count), room(draft));
    const picked = pickTasks(
      { ...params, exam: null, difficulty: null },
      draft,
      (task) => (task.number !== undefined && student.numbers.includes(task.number)) || student.topics.some((topic) => topicMatches(topic, task)),
      count,
      seed,
    );
    if (picked.length === 0) return { kind: "info", text: `По ошибкам ученика (${student.topics.slice(0, 3).join(", ")}) подходящих задач в банке пока нет.` };
    return { kind: "draft", text: `Собрала работу над ошибками: ${tasksWord(picked.length)} по темам ${student.topics.slice(0, 3).join(", ")}.`, items: [...draft, ...picked] };
  }

  if (/аналог/.test(text)) {
    if (!subjectOf(params.subject).computable) {
      return { kind: "info", text: `Для предмета «${subjectOf(params.subject).label}» новые задачи не генерирую: проверить ответ вычислением нельзя. Подберу похожие из банка — напишите «добавь 5 задач №…».` };
    }
    if (room(draft) <= 0) return { kind: "info", text: DRAFT_FULL };
    const number = numberIn(request);
    const count = Math.min(countIn(request, params.count), room(draft));
    const base = draft.find((task) => (number === null || task.number === number) && canGenerate(task)) ?? bankTasks.find((task) => inScope(task, params) && (number === null || task.number === number) && canGenerate(task));
    const analogs = analogsFor(base, count, seed);
    if (analogs.length === 0) return { kind: "info", text: number ? `Для №${number} аналоги пока не генерирую — подберу из банка: «добавь задачи №${number}».` : "Укажите номер: например, «аналоги №6»." };
    return { kind: "draft", text: `Добавила ${tasksWord(analogs.length)} — аналоги ${base?.number !== undefined ? `№${base.number}` : ""}: новые числа, ответы проверены вычислением.`, items: [...draft, ...analogs] };
  }

  // Подбор: «добавь / подбери / сделай N задач на тему или №…».
  if (room(draft) <= 0) return { kind: "info", text: DRAFT_FULL };
  const number = numberIn(request);
  const count = Math.min(countIn(request, params.count), room(draft));
  const byTopic = bankTasks.some((task) => inScope(task, params) && topicMatches(request, task));
  const picked = pickTasks(params, draft, (task) => (number === null || task.number === number) && (!byTopic || topicMatches(request, task)), count, seed);
  if (picked.length === 0) return { kind: "info", text: `В банке «${scopeLabel(params)}» не нашла подходящих задач. Смените экзамен или уточните номер.` };
  const fromAi = picked.filter((task) => task.source === "ai").length;
  return {
    kind: "draft",
    text: `Добавила ${tasksWord(picked.length)}${number !== null ? ` №${number}` : ""} · ${scopeLabel(params)}${fromAi > 0 ? `, из них ${fromAi} — аналоги с проверенным ответом` : " из банка"}.`,
    items: [...draft, ...picked],
  };
}
