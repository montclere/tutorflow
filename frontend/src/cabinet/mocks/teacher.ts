import type { OverviewBase } from "./types";

export const overviewBase: OverviewBase = {
  teacherName: "Анна",
  weekCapacity: 24,
  attention: [
    { kind: "lesson", title: "Отметьте вчерашний урок", note: "Екатерина Орлова · 14:00", studentId: "orlova" },
    { kind: "review", title: "4 работы на проверку", note: "ИИ уже предложил оценки" },
    { kind: "debt", title: "Долг 1 200 ₽", note: "Дмитрий Петров", studentId: "petrov" },
    { kind: "package", title: "Пакет заканчивается", note: "Мария Смирнова · остался 1 урок", studentId: "smirnova" },
    { kind: "inactive", title: "Не занимается 6 дней", note: "Полина Волкова", studentId: "volkova" },
  ],
  examTrends: [
    { studentId: "ivanov", delta: 4 },
    { studentId: "orlova", delta: 2 },
    { studentId: "smirnova", delta: 1 },
    { studentId: "volkova", delta: -3, inactiveDays: 6 },
  ],
};

