import type { ExamData } from "./types";

/** Демо-кабинет ученика — это Александр Иванов из списка учеников репетитора. */
export const demoStudentId = "ivanov";

/** Последний отзыв репетитора — пока проверенных работ с комментарием нет. */
export const studentFeedback = "Анна Кузнецова: «Хорошо! Не забывай про проверку корней»";

export const exam: ExamData = {
  title: "ЕГЭ профиль · вариант 3",
  subtitle: "19 заданий · 3 ч 55 мин · аналоги заданий ФИПИ",
  parts: [
    { title: "Часть 1 · задания 1–12", note: "краткий ответ, проверка мгновенная" },
    { title: "Часть 2 · задания 13–19", note: "решение на фото, проверяет преподаватель" },
  ],
  history: [
    { title: "Вариант 2", date: "12 ноября", score: "14 первичных", tone: "blue" },
    { title: "Вариант 1", date: "5 ноября", score: "11 первичных", tone: "grey" },
  ],
  durationSeconds: 235 * 60,
  taskCount: 19,
  current: { number: 6, question: ["Найдите корень уравнения log", { sub: "5" }, "(2x − 1) = 2."], points: 1 },
};
