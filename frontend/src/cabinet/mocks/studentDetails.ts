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
      { title: "Квадратные уравнения", status: "todo", result: null },
      { title: "Логарифмические уравнения", status: "done", result: "9 из 10" },
      { title: "Окружности, задачи 1–8", status: "done", result: "7 из 8" },
      { title: "Вариант ЕГЭ №1, часть 2", status: "wait", result: null },
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
      { title: "Вариант ОГЭ №2, задания 1–14", status: "done", result: "13 из 14" },
      { title: "Графики функций", status: "done", result: "8 из 9" },
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
      { title: "Тождества, задачи 1–8", status: "todo", result: null },
      { title: "Радианы, задачи 1–6", status: "done", result: "5 из 6" },
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
      { title: "Вариант ОГЭ №3, задание 21", status: "done", result: "2 из 2" },
      { title: "Уравнения, задачи 1–10", status: "done", result: "8 из 10" },
    ],
    trainer: { solvedWeek: 21, accuracy: 69, weak: "№21 · геометрия" },
    notes: [],
  },
  volkova: {
    payments: [
      { date: "2026-11-11", title: "Урок проведён", amount: -130000 },
      { date: "2026-11-01", title: "Оплата по ссылке", amount: 300000 },
    ],
    tasks: [{ title: "Вариант ЕГЭ база №2", status: "done", result: "17 из 20" }],
    trainer: { solvedWeek: 9, accuracy: 80, weak: "№16 · экономика" },
    notes: [{ date: "2026-11-11", text: "Занимается реже обычного." }],
  },
  sokolov: { payments: [], tasks: [], trainer: null, notes: [] },
  belov: {
    payments: [{ date: "2026-10-20", title: "Урок проведён", amount: -140000 }],
    tasks: [{ title: "Сечения, задачи 1–6", status: "done", result: "4 из 6" }],
    trainer: null,
    notes: [{ date: "2026-10-22", text: "Пауза до января." }],
  },
  gromova: { payments: [], tasks: [], trainer: null, notes: [] },
};
