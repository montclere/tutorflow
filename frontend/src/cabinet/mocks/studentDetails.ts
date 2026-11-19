import type { AssignedTask, StudentDetails, StudentMaterial } from "./types";

const baseDetails: Record<string, Omit<StudentDetails, "materials">> = {
  ivanov: {
    payments: [
      { date: "2026-11-14", title: "Урок проведён", amount: -150000 },
      { date: "2026-11-11", title: "Урок проведён", amount: -150000 },
      { date: "2026-11-10", title: "Оплата по ссылке", amount: 300000 },
      { date: "2026-11-07", title: "Урок проведён", amount: -150000 },
    ],
    tasks: [
      { title: "Н и НН, задания 1–10", status: "todo", assignedAt: "2026-11-14", due: "2026-11-19", score: null, mistakes: [] },
      { title: "Вариант ЕГЭ №1, сочинение", status: "wait", assignedAt: "2026-11-12", submittedAt: "2026-11-16", timeMin: 95, score: null, mistakes: [] },
      { title: "Корни с чередованием", status: "done", assignedAt: "2026-11-07", submittedAt: "2026-11-09", timeMin: 38, score: { correct: 9, total: 10 }, mistakes: [{ number: "7", topic: "Чередование гар/гор", answer: "загарать", correct: "загорать" }] },
      { title: "Комментарий, два примера", status: "done", assignedAt: "2026-11-04", submittedAt: "2026-11-06", timeMin: 52, score: { correct: 7, total: 8 }, mistakes: [{ number: "5", topic: "Связь между примерами", answer: "нет связи", correct: "противопоставление" }] },
    ],
    trainer: { solvedWeek: 34, accuracy: 74, weak: "№15 · Н и НН" },
    notes: [
      { date: "2026-11-14", text: "Слабое место — №15, повторить Н и НН в отымённых прилагательных." },
      { date: "2026-10-20", text: "Цель — 85+, поступление на журналистику." },
    ],
  },
  smirnova: {
    payments: [
      { date: "2026-11-13", title: "Урок проведён", amount: -125000 },
      { date: "2026-11-10", title: "Урок проведён", amount: -125000 },
      { date: "2026-10-28", title: "Абонемент, 8 уроков", amount: 1000000 },
    ],
    tasks: [
      { title: "Виды связи", status: "done", assignedAt: "2026-11-10", submittedAt: "2026-11-12", timeMin: 31, score: { correct: 8, total: 9 }, mistakes: [{ number: "6", topic: "Управление и примыкание", answer: "говорить громко", correct: "говорить с волнением" }] },
      { title: "Вариант ОГЭ №2, задания 2–8", status: "done", assignedAt: "2026-11-03", submittedAt: "2026-11-06", timeMin: 64, score: { correct: 13, total: 14 }, mistakes: [{ number: "5", topic: "Приставки пре- и при-", answer: "приодолеть", correct: "преодолеть" }] },
    ],
    trainer: { solvedWeek: 52, accuracy: 91, weak: "№5 · орфография" },
    notes: [{ date: "2026-11-13", text: "Остался один урок, предложить новый абонемент." }],
  },
  petrov: {
    payments: [
      { date: "2026-11-13", title: "Урок проведён", amount: -120000 },
      { date: "2026-11-10", title: "Урок проведён", amount: -120000 },
      { date: "2026-11-06", title: "Оплата по ссылке", amount: 120000 },
    ],
    tasks: [
      { title: "Деепричастия, упражнения 1–8", status: "todo", assignedAt: "2026-11-13", due: "2026-11-20", score: null, mistakes: [] },
      { title: "Причастия, упражнения 1–6", status: "done", assignedAt: "2026-11-06", submittedAt: "2026-11-09", timeMin: 27, score: { correct: 5, total: 6 }, mistakes: [{ number: "4", topic: "Запятые при причастном обороте", answer: "без запятой", correct: "выделить запятыми" }] },
    ],
    trainer: { solvedWeek: 6, accuracy: 58, weak: "деепричастия" },
    notes: [{ date: "2026-11-13", text: "Напомнить родителям про долг." }],
  },
  orlova: {
    payments: [
      { date: "2026-11-16", title: "Урок проведён", amount: -120000 },
      { date: "2026-11-02", title: "Абонемент, 8 уроков", amount: 960000 },
    ],
    tasks: [
      { title: "Обособление, задания 1–10", status: "done", assignedAt: "2026-11-12", submittedAt: "2026-11-14", timeMin: 42, score: { correct: 8, total: 10 }, mistakes: [{ number: "4", topic: "Обособленное определение", answer: "без запятых", correct: "запятые с двух сторон" }, { number: "9", topic: "Обособленное обстоятельство", answer: "одна запятая", correct: "две запятые" }] },
      { title: "Изложение по аудиозаписи", status: "done", assignedAt: "2026-11-05", submittedAt: "2026-11-07", timeMin: 35, score: { correct: 2, total: 2 }, mistakes: [] },
    ],
    trainer: { solvedWeek: 21, accuracy: 69, weak: "№3 · пунктуация" },
    notes: [],
  },
  volkova: {
    payments: [
      { date: "2026-11-11", title: "Урок проведён", amount: -130000 },
      { date: "2026-11-01", title: "Оплата по ссылке", amount: 300000 },
    ],
    tasks: [
      { title: "Вариант ЕГЭ №2, задания 1–26", status: "done", assignedAt: "2026-11-07", submittedAt: "2026-11-10", timeMin: 78, score: { correct: 17, total: 20 }, mistakes: [{ number: "16", topic: "Запятая в ССП", answer: "24", correct: "245" }, { number: "18", topic: "Вводные слова", answer: "13", correct: "134" }, { number: "21", topic: "Пунктуационный анализ", answer: "57", correct: "357" }] },
    ],
    trainer: { solvedWeek: 9, accuracy: 80, weak: "№16 · запятые в ССП" },
    notes: [{ date: "2026-11-11", text: "Занимается реже обычного." }],
  },
  sokolov: { payments: [], tasks: [], trainer: null, notes: [] },
  belov: {
    payments: [{ date: "2026-10-20", title: "Урок проведён", amount: -140000 }],
    tasks: [
      { title: "Обособление, задания 1–6", status: "done", assignedAt: "2026-10-15", submittedAt: "2026-10-18", timeMin: 46, score: { correct: 4, total: 6 }, mistakes: [{ number: "3", topic: "Обособленное приложение", answer: "13", correct: "123" }, { number: "5", topic: "Уточняющие члены", answer: "2", correct: "24" }] },
    ],
    trainer: null,
    notes: [{ date: "2026-10-22", text: "Пауза до января." }],
  },
  gromova: { payments: [], tasks: [], trainer: null, notes: [] },
};

// Более ранние проверенные домашки — чтобы в мониторинге была динамика результатов.
const olderTasks: Record<string, AssignedTask[]> = {
  ivanov: [
    { title: "Приставки, задания 1–10", status: "done", assignedAt: "2026-10-31", due: "2026-11-03", submittedAt: "2026-11-02", timeMin: 41, score: { correct: 8, total: 10 }, mistakes: [{ number: "6", topic: "Н и НН", answer: "кожанный", correct: "кожаный" }, { number: "9", topic: "Приставки пре- и при-", answer: "призирать (врагов)", correct: "презирать" }] },
    { title: "Н и НН, задания 1–8", status: "done", assignedAt: "2026-10-24", due: "2026-10-27", submittedAt: "2026-10-28", timeMin: 47, score: { correct: 5, total: 8 }, mistakes: [{ number: "2", topic: "Н и НН", answer: "серебрянный", correct: "серебряный" }, { number: "5", topic: "Краткие причастия", answer: "решенна", correct: "решена" }, { number: "8", topic: "Н и НН", answer: "ветренный", correct: "ветреный" }] },
    { title: "Вариант ЕГЭ, задания 1–12", status: "done", assignedAt: "2026-10-17", due: "2026-10-21", submittedAt: "2026-10-20", timeMin: 88, score: { correct: 9, total: 12 }, mistakes: [{ number: "4", topic: "Ударения", answer: "катАлог", correct: "каталОг" }, { number: "9", topic: "Запятая в ССП", answer: "1", correct: "13" }, { number: "11", topic: "Суффиксы", answer: "замочик", correct: "замочек" }] },
    { title: "Запятые в ССП, задания 1–6", status: "done", assignedAt: "2026-10-10", due: "2026-10-13", submittedAt: "2026-10-13", timeMin: 36, score: { correct: 4, total: 6 }, mistakes: [{ number: "3", topic: "Запятая в ССП", answer: "без запятой", correct: "запятая перед «и»" }, { number: "6", topic: "Однородные члены", answer: "две запятые", correct: "одна запятая" }] },
  ],
  smirnova: [
    { title: "Орфография, задания 1–10", status: "done", assignedAt: "2026-10-27", due: "2026-10-30", submittedAt: "2026-10-29", timeMin: 33, score: { correct: 8, total: 10 }, mistakes: [{ number: "4", topic: "Приставки пре- и при-", answer: "пребежать", correct: "прибежать" }, { number: "8", topic: "Приставки на з/с", answer: "безсильный", correct: "бессильный" }] },
    { title: "Вариант ОГЭ №1", status: "done", assignedAt: "2026-10-20", due: "2026-10-24", submittedAt: "2026-10-23", timeMin: 70, score: { correct: 11, total: 14 }, mistakes: [{ number: "5", topic: "Приставки пре- и при-", answer: "преоткрыть", correct: "приоткрыть" }, { number: "7", topic: "Метафора и сравнение", answer: "1", correct: "2" }, { number: "8", topic: "Синонимы", answer: "видеть", correct: "смотреть" }] },
  ],
  orlova: [
    { title: "Вводные слова, задания 1–8", status: "done", assignedAt: "2026-10-29", due: "2026-11-01", submittedAt: "2026-11-03", timeMin: 39, score: { correct: 5, total: 8 }, mistakes: [{ number: "2", topic: "Обособленное определение", answer: "1", correct: "12" }, { number: "6", topic: "Вводные слова", answer: "без запятых", correct: "выделить запятыми" }, { number: "7", topic: "Обращения", answer: "одна запятая", correct: "две запятые" }] },
  ],
};

const materials: Record<string, StudentMaterial[]> = {
  ivanov: [
    { id: "m-ivanov-1", title: "Н и НН: правила и исключения", kind: "pdf", fileName: "n-nn-teoriya.pdf", sizeBytes: 1_240_000, note: "Перед уроком прочитай страницы 2–4.", sentAt: "2026-11-14", openedAt: "2026-11-15" },
    { id: "m-ivanov-2", title: "Шпаргалка по ударениям", kind: "image", fileName: "udareniya.png", sizeBytes: 420_000, sentAt: "2026-11-07", openedAt: "2026-11-07" },
    { id: "m-ivanov-3", title: "Разбор сочинения №27 — видео", kind: "link", url: "https://www.youtube.com/", sentAt: "2026-11-03", openedAt: null },
  ],
  smirnova: [{ id: "m-smirnova-1", title: "Клише для сочинения 9.2", kind: "pdf", fileName: "oge-sochinenie-klishe.pdf", sizeBytes: 860_000, sentAt: "2026-11-10", openedAt: "2026-11-11" }],
  petrov: [{ id: "m-petrov-1", title: "Причастие и деепричастие", kind: "slides", fileName: "prichastie-deeprichastie.pptx", sizeBytes: 2_300_000, sentAt: "2026-11-06", openedAt: null }],
  orlova: [],
  volkova: [{ id: "m-volkova-1", title: "Аргументы для сочинения", kind: "doc", fileName: "argumenty.docx", sizeBytes: 96_000, sentAt: "2026-11-01", openedAt: "2026-11-02" }],
};

export const studentDetails: Record<string, StudentDetails> = Object.fromEntries(
  Object.entries(baseDetails).map(([id, details]) => [id, { ...details, tasks: [...details.tasks, ...(olderTasks[id] ?? [])], materials: materials[id] ?? [] }]),
);
