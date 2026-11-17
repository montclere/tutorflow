import type { Finance, OverviewBase, Review } from "./types";

export const overviewBase: OverviewBase = {
  teacherName: "Анна",
  weekCapacity: 24,
  attention: [
    { kind: "lesson", title: "Отметьте вчерашний урок", note: "Екатерина Орлова · 14:00" },
    { kind: "review", title: "4 работы на проверку", note: "ИИ уже предложил оценки" },
    { kind: "debt", title: "Долг 1 200 ₽", note: "Дмитрий Петров" },
    { kind: "package", title: "Пакет заканчивается", note: "Мария Смирнова · остался 1 урок" },
    { kind: "inactive", title: "Не занимается 6 дней", note: "Полина Волкова" },
  ],
  examTrends: [
    { studentId: "ivanov", delta: 4 },
    { studentId: "orlova", delta: 2 },
    { studentId: "smirnova", delta: 1 },
    { studentId: "volkova", delta: -3, inactiveDays: 6 },
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
    { date: "13.11", studentId: "petrov", title: "Урок проведён", amountKopecks: -120000 },
    { date: "15.11", studentId: "orlova", title: "Пакет 8 уроков", amountKopecks: 960000 },
  ],
};

export const review: Review = {
  queue: [
    { studentId: "ivanov", title: "Квадратные уравнения · №7", when: "сегодня, 12:15", aiScore: "1 из 2", note: "Корни найдены верно, но не выполнена проверка: x = −1 не входит в ОДЗ." },
    { studentId: "orlova", title: "Вариант ОГЭ №3 · №21", when: "сегодня, 10:40", aiScore: "2 из 2", note: "Решение полное, ошибок нет." },
    { studentId: "ivanov", title: "Квадратные уравнения · №8", when: "вчера, 19:20", aiScore: "0 из 2", note: "Ошибка в знаке при переносе во второй строке." },
    { studentId: "volkova", title: "Вариант ЕГЭ база №2 · №16", when: "вчера, 17:05", aiScore: "1 из 1", note: "Ответ верный, но не записан ход решения." },
  ],
  solution: {
    lines: ["4ˣ − 5·2ˣ + 4 = 0", "Пусть t = 2ˣ, t > 0", "t² − 5t + 4 = 0", "t = 1, t = 4", "2ˣ = 1 → x = 0;  2ˣ = 4 → x = 2"],
    mistake: "Ответ: 0; 2; −1",
  },
};
