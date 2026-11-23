import type { Person, StudentRecord } from "./types";

export const students: StudentRecord[] = [
  {
    id: "ivanov", name: "Александр Иванов", initials: "АИ", color: "peach", goal: "ЕГЭ · цель 85+", status: "active",
    payment: { model: "per_lesson", pricePerLesson: 150000 }, balance: 0, lessonsCount: 18, startedAt: "2026-09-01",
    telegramConnected: true, parent: { name: "Ольга Иванова", relation: "Мама", phone: "+7 912 345-67-89" }, source: "Знакомые",
    exam: { daysLeft: 191, readiness: 61, weak: [15, 16] },
    recentLessons: [
      { date: "2026-11-16", topic: "Н и НН в прилагательных и причастиях", status: "done", homework: { title: "Н и НН, задания 1–10", done: null, total: 10 } },
      { date: "2026-11-13", topic: "Правописание корней", status: "done", homework: { title: "Корни с чередованием", done: 9, total: 10 } },
      { date: "2026-11-10", topic: "Сочинение: комментарий к проблеме", status: "done", homework: { title: "Комментарий, два примера", done: 7, total: 8 } },
      { date: "2026-11-09", topic: "Пунктуация в ССП", status: "moved", homework: null },
      { date: "2026-11-06", topic: "Орфоэпия: ударения", status: "done", homework: { title: "Вариант ЕГЭ №1, задания 1–12", done: 10, total: 12 } },
    ],
    note: "Слабые места — Н и НН (№15) и запятые в ССП (№16). Сочинение пишет охотно, но комментарий короткий.",
  },
  {
    id: "smirnova", name: "Мария Смирнова", initials: "МС", color: "mint", goal: "ОГЭ · цель 5", status: "active",
    payment: { model: "package", pricePerLesson: 125000, package: { lessons: 8, price: 125000, left: 1 } }, balance: 450000, lessonsCount: 24, startedAt: "2026-02-10",
    telegramConnected: true, parent: { name: "Ирина Смирнова", relation: "Мама", phone: "+7 903 111-22-33" }, source: "Авито",
    exam: { daysLeft: 197, readiness: 88, weak: [5] },
    recentLessons: [
      { date: "2026-11-12", topic: "Сочинение 9.2", status: "done", homework: { title: "Вариант ОГЭ №2, задания 2–8", done: 6, total: 7 } },
      { date: "2026-11-11", topic: "Средства выразительности", status: "done", homework: { title: "Тропы, задания 1–10", done: 10, total: 10 } },
      { date: "2026-11-10", topic: "Словосочетания: виды связи", status: "done", homework: { title: "Виды связи", done: 8, total: 9 } },
    ],
    note: "Остался один оплаченный урок, предложить новый пакет.",
  },
  {
    id: "petrov", name: "Дмитрий Петров", initials: "ДП", color: "rose", goal: "Русский · 7 класс", status: "active",
    payment: { model: "per_lesson", pricePerLesson: 120000 }, balance: -120000, lessonsCount: 9, startedAt: "2026-09-20",
    telegramConnected: false, parent: { name: "Сергей Петров", relation: "Папа", phone: "+7 926 555-44-33" }, source: "Профи.ру",
    recentLessons: [
      { date: "2026-11-13", topic: "Деепричастный оборот", status: "done", homework: { title: "Деепричастия, упражнения 1–8", done: null, total: 8 } },
      { date: "2026-11-11", topic: "Причастный оборот", status: "done", homework: { title: "Причастия, упражнения 1–6", done: 5, total: 6 } },
    ],
    note: "Есть долг, напомнить родителям. Не подключён к Telegram, отправить ссылку.",
  },
  {
    id: "orlova", name: "Екатерина Орлова", initials: "ЕО", color: "sky", goal: "ОГЭ · цель 4", status: "active",
    payment: { model: "package", pricePerLesson: 120000, package: { lessons: 8, price: 120000, left: 4 } }, balance: 480000, lessonsCount: 12, startedAt: "2026-08-25",
    telegramConnected: true, source: "Сайт",
    exam: { daysLeft: 197, readiness: 71, weak: [3] },
    recentLessons: [
      { date: "2026-11-17", topic: "Сжатое изложение: приёмы сжатия", status: "done", homework: { title: "Изложение по аудиозаписи", done: 2, total: 2 } },
      { date: "2026-11-16", topic: "Пунктуация: обособленные члены", status: "done", homework: { title: "Обособление, задания 1–10", done: 8, total: 10 } },
    ],
    note: "Изложение пишет хорошо, подтянуть пунктуацию.",
  },
  {
    id: "volkova", name: "Полина Волкова", initials: "ПВ", color: "lilac", goal: "ЕГЭ · цель 70+", status: "active",
    payment: { model: "per_lesson", pricePerLesson: 130000 }, balance: 160000, lessonsCount: 15, startedAt: "2026-03-05",
    telegramConnected: true, parent: { name: "Наталья Волкова", relation: "Мама", phone: "+7 905 777-88-99" }, source: "Знакомые",
    exam: { daysLeft: 191, readiness: 84, weak: [27] },
    recentLessons: [
      { date: "2026-11-16", topic: "Сочинение: позиция автора", status: "done", homework: { title: "Вариант ЕГЭ №2, задания 1–26", done: 17, total: 20 } },
      { date: "2026-11-13", topic: "Паронимы и лексические нормы", status: "done", homework: { title: "Паронимы, задания 1–8", done: 8, total: 8 } },
    ],
    note: "Занимается реже обычного, написать в Telegram.",
  },
  {
    id: "sokolov", name: "Илья Соколов", initials: "ИС", color: "teal", goal: "ОГЭ · цель 4", status: "active",
    payment: { model: "per_lesson", pricePerLesson: 100000 }, balance: 0, lessonsCount: 0, startedAt: "2026-11-21",
    telegramConnected: false, parent: { name: "Андрей Соколов", relation: "Папа", phone: "+7 918 222-33-44" }, source: "Авито",
    recentLessons: [],
    note: "Пробный урок, обсудить цели и расписание.",
  },
  {
    id: "belov", name: "Артём Белов", initials: "АБ", color: "mint", goal: "ЕГЭ · цель 60+", status: "pause",
    payment: { model: "per_lesson", pricePerLesson: 140000 }, balance: 0, lessonsCount: 21, startedAt: "2026-01-15",
    telegramConnected: true, source: "Профи.ру",
    exam: { daysLeft: 191, readiness: 54, weak: [17, 21] },
    recentLessons: [
      { date: "2026-10-20", topic: "Обособленные определения", status: "done", homework: { title: "Обособление, задания 1–6", done: 4, total: 6 } },
    ],
    note: "На паузе до января, вернуться к занятиям после сессии.",
  },
  {
    id: "gromova", name: "Софья Громова", initials: "СГ", color: "sky", goal: "ОГЭ · цель 5", status: "archive",
    payment: { model: "package", pricePerLesson: 110000, package: { lessons: 8, price: 110000, left: 0 } }, balance: 0, lessonsCount: 32, startedAt: "2025-09-10",
    telegramConnected: true, source: "Знакомые",
    recentLessons: [
      { date: "2026-06-05", topic: "Итоговое повторение", status: "done", homework: null },
    ],
    note: "Сдала ОГЭ на 5, занятия завершены.",
  },
];

/** Предметы из профиля репетитора. Сейчас один — поле «Предмет» нигде не показывается. */
export const teacherSubjects: string[] = ["Русский язык"];

export const teacherPerson: Person = { name: "Анна Кузнецова", initials: "АК", color: "sky", roleLabel: "Репетитор" };
export const studentPerson: Person = { name: "Александр Иванов", initials: "АИ", color: "peach", roleLabel: "Ученик · ЕГЭ по русскому" };
