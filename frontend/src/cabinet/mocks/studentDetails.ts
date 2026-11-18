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
      { title: "Квадратные уравнения", status: "todo", assignedAt: "2026-11-14", due: "2026-11-19", score: null, mistakes: [] },
      { title: "Вариант ЕГЭ №1, часть 2", status: "wait", assignedAt: "2026-11-12", submittedAt: "2026-11-16", timeMin: 95, score: null, mistakes: [] },
      { title: "Логарифмические уравнения", status: "done", assignedAt: "2026-11-07", submittedAt: "2026-11-09", timeMin: 38, score: { correct: 9, total: 10 }, mistakes: [{ number: "7", topic: "ОДЗ логарифма", answer: "3", correct: "5" }] },
      { title: "Окружности, задачи 1–8", status: "done", assignedAt: "2026-11-04", submittedAt: "2026-11-06", timeMin: 52, score: { correct: 7, total: 8 }, mistakes: [{ number: "5", topic: "Вписанный угол", answer: "48°", correct: "24°" }] },
    ],
    trainer: { solvedWeek: 34, accuracy: 74, weak: "№13 · уравнения" },
    notes: [
      { date: "2026-11-14", text: "Слабое место — №13, чаще проверять ОДЗ." },
      { date: "2026-10-20", text: "Цель — 80+, поступление в технический вуз." },
    ],
  },
  smirnova: {
    payments: [
      { date: "2026-11-13", title: "Урок проведён", amount: -125000 },
      { date: "2026-11-10", title: "Урок проведён", amount: -125000 },
      { date: "2026-10-28", title: "Абонемент, 8 уроков", amount: 1000000 },
    ],
    tasks: [
      { title: "Графики функций", status: "done", assignedAt: "2026-11-10", submittedAt: "2026-11-12", timeMin: 31, score: { correct: 8, total: 9 }, mistakes: [{ number: "6", topic: "Сдвиг графика", answer: "y = x² + 2", correct: "y = (x + 2)²" }] },
      { title: "Вариант ОГЭ №2, задания 1–14", status: "done", assignedAt: "2026-11-03", submittedAt: "2026-11-06", timeMin: 64, score: { correct: 13, total: 14 }, mistakes: [{ number: "9", topic: "Прикладные задачи", answer: "36", correct: "42" }] },
    ],
    trainer: { solvedWeek: 52, accuracy: 91, weak: "№9 · прикладные задачи" },
    notes: [{ date: "2026-11-13", text: "Остался один урок, предложить новый абонемент." }],
  },
  petrov: {
    payments: [
      { date: "2026-11-13", title: "Урок проведён", amount: -120000 },
      { date: "2026-11-10", title: "Урок проведён", amount: -120000 },
      { date: "2026-11-06", title: "Оплата по ссылке", amount: 120000 },
    ],
    tasks: [
      { title: "Тождества, задачи 1–8", status: "todo", assignedAt: "2026-11-13", due: "2026-11-20", score: null, mistakes: [] },
      { title: "Радианы, задачи 1–6", status: "done", assignedAt: "2026-11-06", submittedAt: "2026-11-09", timeMin: 27, score: { correct: 5, total: 6 }, mistakes: [{ number: "4", topic: "Перевод в радианы", answer: "π/3", correct: "π/6" }] },
    ],
    trainer: { solvedWeek: 6, accuracy: 58, weak: "тригонометрия" },
    notes: [{ date: "2026-11-13", text: "Напомнить родителям про долг." }],
  },
  orlova: {
    payments: [
      { date: "2026-11-16", title: "Урок проведён", amount: -120000 },
      { date: "2026-11-02", title: "Абонемент, 8 уроков", amount: 960000 },
    ],
    tasks: [
      { title: "Уравнения, задачи 1–10", status: "done", assignedAt: "2026-11-12", submittedAt: "2026-11-14", timeMin: 42, score: { correct: 8, total: 10 }, mistakes: [{ number: "4", topic: "Знак при переносе", answer: "x = 3", correct: "x = −3" }, { number: "9", topic: "Дробное уравнение", answer: "x = 2", correct: "нет корней" }] },
      { title: "Вариант ОГЭ №3, задание 21", status: "done", assignedAt: "2026-11-05", submittedAt: "2026-11-07", timeMin: 35, score: { correct: 2, total: 2 }, mistakes: [] },
    ],
    trainer: { solvedWeek: 21, accuracy: 69, weak: "№21 · геометрия" },
    notes: [],
  },
  volkova: {
    payments: [
      { date: "2026-11-11", title: "Урок проведён", amount: -130000 },
      { date: "2026-11-01", title: "Оплата по ссылке", amount: 300000 },
    ],
    tasks: [
      { title: "Вариант ЕГЭ база №2", status: "done", assignedAt: "2026-11-07", submittedAt: "2026-11-10", timeMin: 78, score: { correct: 17, total: 20 }, mistakes: [{ number: "16", topic: "Экономика: проценты", answer: "12 000", correct: "11 520" }, { number: "18", topic: "Графики", answer: "3", correct: "4" }, { number: "19", topic: "Свойства чисел", answer: "27", correct: "36" }] },
    ],
    trainer: { solvedWeek: 9, accuracy: 80, weak: "№16 · экономика" },
    notes: [{ date: "2026-11-11", text: "Занимается реже обычного." }],
  },
  sokolov: { payments: [], tasks: [], trainer: null, notes: [] },
  belov: {
    payments: [{ date: "2026-10-20", title: "Урок проведён", amount: -140000 }],
    tasks: [
      { title: "Сечения, задачи 1–6", status: "done", assignedAt: "2026-10-15", submittedAt: "2026-10-18", timeMin: 46, score: { correct: 4, total: 6 }, mistakes: [{ number: "3", topic: "Сечение призмы", answer: "√13", correct: "5" }, { number: "5", topic: "Угол между плоскостями", answer: "30°", correct: "45°" }] },
    ],
    trainer: null,
    notes: [{ date: "2026-10-22", text: "Пауза до января." }],
  },
  gromova: { payments: [], tasks: [], trainer: null, notes: [] },
};

// Более ранние проверенные домашки — чтобы в мониторинге была динамика результатов.
const olderTasks: Record<string, AssignedTask[]> = {
  ivanov: [
    { title: "Показательные уравнения", status: "done", assignedAt: "2026-10-31", due: "2026-11-03", submittedAt: "2026-11-02", timeMin: 41, score: { correct: 8, total: 10 }, mistakes: [{ number: "6", topic: "ОДЗ логарифма", answer: "x = 0", correct: "нет корней" }, { number: "9", topic: "Замена переменной", answer: "2", correct: "4" }] },
    { title: "Производная, задачи 1–8", status: "done", assignedAt: "2026-10-24", due: "2026-10-27", submittedAt: "2026-10-28", timeMin: 47, score: { correct: 5, total: 8 }, mistakes: [{ number: "2", topic: "Производная сложной функции", answer: "2cos x", correct: "2cos 2x" }, { number: "5", topic: "Наибольшее значение", answer: "7", correct: "9" }, { number: "8", topic: "ОДЗ логарифма", answer: "1", correct: "e" }] },
    { title: "Вариант ЕГЭ, часть 1", status: "done", assignedAt: "2026-10-17", due: "2026-10-21", submittedAt: "2026-10-20", timeMin: 88, score: { correct: 9, total: 12 }, mistakes: [{ number: "4", topic: "Теория вероятностей", answer: "0,3", correct: "0,35" }, { number: "9", topic: "Графики функций", answer: "−2", correct: "2" }, { number: "11", topic: "Производная сложной функции", answer: "3", correct: "−3" }] },
    { title: "Тригонометрия, задачи 1–6", status: "done", assignedAt: "2026-10-10", due: "2026-10-13", submittedAt: "2026-10-13", timeMin: 36, score: { correct: 4, total: 6 }, mistakes: [{ number: "3", topic: "Формулы приведения", answer: "sin x", correct: "−sin x" }, { number: "6", topic: "Отбор корней", answer: "2 корня", correct: "3 корня" }] },
  ],
  smirnova: [
    { title: "Неравенства, задачи 1–10", status: "done", assignedAt: "2026-10-27", due: "2026-10-30", submittedAt: "2026-10-29", timeMin: 33, score: { correct: 8, total: 10 }, mistakes: [{ number: "4", topic: "Знак неравенства", answer: "x > 2", correct: "x < 2" }, { number: "8", topic: "Прикладные задачи", answer: "15", correct: "18" }] },
    { title: "Вариант ОГЭ №1", status: "done", assignedAt: "2026-10-20", due: "2026-10-24", submittedAt: "2026-10-23", timeMin: 70, score: { correct: 11, total: 14 }, mistakes: [{ number: "5", topic: "Графики функций", answer: "1", correct: "3" }, { number: "9", topic: "Прикладные задачи", answer: "120", correct: "150" }, { number: "12", topic: "Площадь фигуры", answer: "24", correct: "12" }] },
  ],
  orlova: [
    { title: "Дроби, задачи 1–8", status: "done", assignedAt: "2026-10-29", due: "2026-11-01", submittedAt: "2026-11-03", timeMin: 39, score: { correct: 5, total: 8 }, mistakes: [{ number: "2", topic: "Знак при переносе", answer: "−5", correct: "5" }, { number: "6", topic: "Дробное уравнение", answer: "x = 1", correct: "x = −1" }, { number: "7", topic: "Общий знаменатель", answer: "12", correct: "24" }] },
  ],
};

const materials: Record<string, StudentMaterial[]> = {
  ivanov: [
    { id: "m-ivanov-1", title: "Логарифмы: свойства и ОДЗ", kind: "pdf", fileName: "logarifmy-teoriya.pdf", sizeBytes: 1_240_000, note: "Перед уроком прочитай страницы 2–4.", sentAt: "2026-11-14", openedAt: "2026-11-15" },
    { id: "m-ivanov-2", title: "Шпаргалка по производным", kind: "image", fileName: "proizvodnye.png", sizeBytes: 420_000, sentAt: "2026-11-07", openedAt: "2026-11-07" },
    { id: "m-ivanov-3", title: "Разбор №13 — видео", kind: "link", url: "https://www.youtube.com/", sentAt: "2026-11-03", openedAt: null },
  ],
  smirnova: [{ id: "m-smirnova-1", title: "Формулы ОГЭ по геометрии", kind: "pdf", fileName: "ogje-geometriya.pdf", sizeBytes: 860_000, sentAt: "2026-11-10", openedAt: "2026-11-11" }],
  petrov: [{ id: "m-petrov-1", title: "Тригонометрический круг", kind: "slides", fileName: "trig-krug.pptx", sizeBytes: 2_300_000, sentAt: "2026-11-06", openedAt: null }],
  orlova: [],
  volkova: [{ id: "m-volkova-1", title: "Задачи на проценты", kind: "doc", fileName: "procenty.docx", sizeBytes: 96_000, sentAt: "2026-11-01", openedAt: "2026-11-02" }],
};

export const studentDetails: Record<string, StudentDetails> = Object.fromEntries(
  Object.entries(baseDetails).map(([id, details]) => [id, { ...details, tasks: [...details.tasks, ...(olderTasks[id] ?? [])], materials: materials[id] ?? [] }]),
);
