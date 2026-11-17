import type { Finance, Review, Schedule, TeacherOverview } from "./types";

export const teacherOverview: TeacherOverview = {
  greeting: "Добрый день, Анна",
  date: "Вторник, 17 ноября · 5 уроков, 4 работы на проверку",
  stats: [
    { label: "Получено за ноябрь", value: "82 400 ₽", note: "+12% к октябрю", highlight: true },
    { label: "Заработано уроками", value: "76 000 ₽", note: "42 урока" },
    { label: "Должны", value: "1 200 ₽", note: "1 ученик" },
    { label: "На проверке", value: "4", note: "2 с подсказкой ИИ" },
  ],
  lessons: [
    { time: "15:00", studentId: "ivanov", subject: "Математика · ЕГЭ", tone: "blue", status: "Скоро" },
    { time: "16:30", studentId: "smirnova", subject: "Английский · B1", tone: "ok", status: "Оплачено" },
    { time: "18:00", studentId: "petrov", subject: "Физика · 10 класс", tone: "bad", status: "Долг" },
  ],
  alerts: [
    { icon: "⏱", title: "Отметьте вчерашний урок", note: "Екатерина Орлова · 18:00" },
    { icon: "💳", title: "Долг 1 200 ₽", note: "Дмитрий Петров · напомнить в Telegram" },
    { icon: "📝", title: "4 работы на проверку", note: "ИИ уже предложил оценки" },
    { icon: "📦", title: "Пакет заканчивается", note: "Мария Смирнова · остался 1 урок" },
  ],
  trainerWeek: [
    { studentId: "ivanov", solved: 34, note: "слабое место: №13 · 40%" },
    { studentId: "orlova", solved: 21, note: "слабое место: №15 · 52%" },
    { studentId: "volkova", solved: 9, note: "реже обычного" },
  ],
  tasksWeek: [
    { title: "Квадратные уравнения", note: "Александр · до пт", tone: "warn", status: "Не сдано" },
    { title: "Past Perfect", note: "Мария · сдано", tone: "blue", status: "Проверить" },
    { title: "Вариант ОГЭ №3", note: "Екатерина · 21/31", tone: "ok", status: "Проверено" },
  ],
};

export const schedule: Schedule = {
  range: "16 — 20 ноября",
  days: ["Пн 16", "Вт 17", "Ср 18", "Чт 19", "Пт 20"],
  todayIndex: 1,
  hours: ["14:00", "15:00", "16:00", "17:00", "18:00"],
  events: [
    { day: 1, hour: 1, studentId: "smirnova", tone: "ok" },
    { day: 2, hour: 1, studentId: "petrov", tone: "bad" },
    { day: 4, hour: 1, studentId: "orlova", tone: "bad" },
    { day: 0, hour: 0, studentId: "volkova", tone: "blue" },
    { day: 2, hour: 3, studentId: "ivanov", tone: "blue" },
    { day: 3, hour: 4, studentId: "volkova", tone: "ok" },
    { day: 1, hour: 2, studentId: "smirnova", tone: "ok" },
  ],
};

export const finance: Finance = {
  month: "Ноябрь 2026",
  stats: [
    { label: "Получено", value: "82 400 ₽", note: "оплаты за месяц", highlight: true },
    { label: "Заработано", value: "76 000 ₽", note: "проведённые уроки" },
    { label: "Долг", value: "1 200 ₽", note: "сейчас" },
    { label: "Предоплаты", value: "10 900 ₽", note: "сейчас" },
  ],
  operations: [
    { date: "17.11", studentId: "smirnova", title: "Оплата по ссылке · чек отправлен", amountKopecks: 400000 },
    { date: "16.11", studentId: "ivanov", title: "Урок проведён", amountKopecks: -150000 },
    { date: "16.11", studentId: "petrov", title: "Урок проведён", amountKopecks: -120000 },
    { date: "15.11", studentId: "orlova", title: "Пакет 8 уроков", amountKopecks: 960000 },
  ],
};

export const review: Review = {
  queue: [
    { studentId: "ivanov", title: "Квадратные уравнения · №7", when: "сегодня, 12:15", aiScore: "1 из 2", note: "Корни найдены верно, но не выполнена проверка: x = −1 не входит в ОДЗ." },
    { studentId: "orlova", title: "Вариант ОГЭ №3 · №21", when: "сегодня, 10:40", aiScore: "2 из 2", note: "Решение полное, ошибок нет." },
    { studentId: "ivanov", title: "Квадратные уравнения · №8", when: "вчера, 19:20", aiScore: "0 из 2", note: "Ошибка в знаке при переносе во второй строке." },
    { studentId: "volkova", title: "Сочинение ОГЭ · 13.3", when: "вчера, 17:05", aiScore: "5 из 7", note: "Позиция сформулирована, второй пример слабый." },
  ],
  solution: {
    lines: ["4ˣ − 5·2ˣ + 4 = 0", "Пусть t = 2ˣ, t > 0", "t² − 5t + 4 = 0", "t = 1, t = 4", "2ˣ = 1 → x = 0;  2ˣ = 4 → x = 2"],
    mistake: "Ответ: 0; 2; −1",
  },
};
