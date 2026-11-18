import type { StudentDetails } from "./types";

export const studentDetails: Record<string, StudentDetails> = {
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
