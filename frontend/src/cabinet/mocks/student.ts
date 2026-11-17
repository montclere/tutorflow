import { examNumbers } from "./tasks";
import type { ExamData, Homework, Progress, StudentHome, TrainerData } from "./types";

export const studentHome: StudentHome = {
  greeting: "Привет, Александр",
  subtitle: "До ЕГЭ 191 день · серия 4 дня",
  stats: [
    { label: "Ближайший урок", value: "Ср 16:00", note: "Математика · Анна К.", highlight: true },
    { label: "Заданий к сдаче", value: "2", note: "ближайшее до пт" },
    { label: "Решено за неделю", value: "34", note: "в тренажёре" },
    { label: "Пробный вариант", value: "61%", note: "14 первичных баллов" },
  ],
  homework: [
    { title: "Квадратные уравнения", note: "10 карточек · до пятницы", tone: "warn", status: "Не начато" },
    { title: "Вероятность: №4 и №5", note: "15 карточек · до 24 ноября", tone: "blue", status: "7 из 15" },
    { title: "Показательные уравнения", note: "результат 9/10", tone: "ok", status: "Проверено" },
  ],
  weak: [
    { number: 13, topic: "Уравнения+", percent: 40 },
    { number: 15, topic: "Неравенства", percent: 48 },
    { number: 8, topic: "Производная", percent: 62 },
  ],
  feedback: {
    title: "Показательные уравнения · 9/10",
    text: "Анна Кузнецова: «Хорошо! Не забывай про проверку корней»",
  },
};

export const homework: Homework = {
  todo: [
    { title: "Квадратные уравнения", subtitle: "10 карточек · ДЗ · подсказки можно", deadline: "до пятницы, 21 ноября", tone: "warn", status: "Не начато" },
    { title: "Вероятность: №4 и №5", subtitle: "15 карточек · ДЗ", deadline: "до 24 ноября", tone: "blue", status: "7 из 15" },
  ],
  waiting: { title: "Квадратные уравнения: развёрнутые", note: "Сдано сегодня в 12:15 · 2 фото", status: "У преподавателя" },
  done: {
    title: "Показательные уравнения",
    checkedOn: "Проверено 15 ноября",
    score: "9 / 10",
    results: [
      { ok: true, title: "8 карточек верно", note: "проверено автоматически" },
      { ok: false, title: "№6: ваш ответ 2, верно −2", note: "Разбор: при делении на отрицательное число знак меняется" },
    ],
  },
};

export const trainer: TrainerData = {
  streak: 4,
  solved: 17,
  dailyGoal: 20,
  numbers: examNumbers.slice(0, 12),
  drills: [
    { number: 6, question: ["Найдите корень уравнения 3", { sup: "x−2" }, " = 27."], answer: "5", hint: "27 = 3³, значит x − 2 = 3.", solution: "27 = 3³ → x − 2 = 3 → x = 5." },
    { number: 7, question: ["Найдите значение выражения log", { sub: "2" }, "32 − log", { sub: "3" }, "9."], answer: "3", hint: "log₂32 = 5, log₃9 = 2.", solution: "5 − 2 = 3." },
    { number: 6, question: ["Решите уравнение √(2x + 7) = 5."], answer: "9", hint: "Возведите обе части в квадрат.", solution: "2x + 7 = 25 → x = 9. Проверка: √25 = 5." },
    { number: 6, question: ["Решите уравнение x² − 5x + 6 = 0. В ответе укажите больший корень."], answer: "3", hint: "По теореме Виета сумма корней 5, произведение 6.", solution: "Корни 2 и 3, больший — 3." },
  ],
};

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

export const progress: Progress = {
  stats: [
    { label: "Освоено номеров", value: "7 из 19", note: "↗ +2 за месяц", highlight: true },
    { label: "Точность в тренажёре", value: "74%", note: "последние 100 задач" },
    { label: "Лучший вариант", value: "14", note: "первичных баллов" },
  ],
  levels: [3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0, 0, 0, 0, 0, 0, 0],
};
