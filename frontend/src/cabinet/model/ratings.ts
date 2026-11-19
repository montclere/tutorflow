import { useSyncExternalStore } from "react";

/** Оценка урока учеником: звёзды 1–5 и необязательный комментарий (VIBE-11). В демо — в памяти. */
export type Stars = 1 | 2 | 3 | 4 | 5;
export type LessonRating = { studentId: string; date: string; topic: string; stars: Stars; comment?: string };

const seed: LessonRating[] = [
  { studentId: "ivanov", date: "2026-11-13", topic: "Логарифмы", stars: 5, comment: "Наконец понял ОДЗ!" },
  { studentId: "ivanov", date: "2026-11-10", topic: "Планиметрия: окружности", stars: 5 },
  { studentId: "ivanov", date: "2026-11-06", topic: "Производная", stars: 4 },
  { studentId: "smirnova", date: "2026-11-12", topic: "Графики функций", stars: 5 },
  { studentId: "smirnova", date: "2026-11-05", topic: "Вариант ОГЭ", stars: 5 },
  { studentId: "petrov", date: "2026-11-13", topic: "Тождества", stars: 3, comment: "Было быстро, не всё успел" },
  { studentId: "petrov", date: "2026-11-06", topic: "Радианы", stars: 4 },
  { studentId: "orlova", date: "2026-11-16", topic: "Уравнения", stars: 5 },
  { studentId: "volkova", date: "2026-11-11", topic: "Проценты", stars: 4 },
];

let ratings = seed;
const listeners = new Set<() => void>();

export function getRatings(): LessonRating[] {
  return ratings;
}

export function subscribeRatings(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRatings(): LessonRating[] {
  return useSyncExternalStore(subscribeRatings, getRatings);
}

export function addRating(rating: LessonRating): void {
  ratings = [rating, ...ratings.filter((item) => !(item.studentId === rating.studentId && item.date === rating.date))];
  for (const listener of listeners) listener();
}

export function isRated(list: LessonRating[], studentId: string, date: string): boolean {
  return list.some((item) => item.studentId === studentId && item.date === date);
}

/** Удовлетворённость: средняя оценка с одним знаком и число оценок. */
export function satisfaction(list: LessonRating[], studentId: string): { average: number; count: number; last?: LessonRating } | null {
  const own = list.filter((item) => item.studentId === studentId);
  if (own.length === 0) return null;
  const average = Math.round((own.reduce((sum, item) => sum + item.stars, 0) / own.length) * 10) / 10;
  return { average, count: own.length, last: own[0] };
}
