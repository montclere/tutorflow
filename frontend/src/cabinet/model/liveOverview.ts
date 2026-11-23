import type { ScheduleLesson } from "../mocks/types";
import { addDays, weekDates } from "./dates";
import { compareLessons, isPast } from "./lessons";

export type LiveOverview = {
  today: ScheduleLesson[];
  tomorrow: ScheduleLesson[];
  /** Прошедшие запланированные уроки без отметки — новые сверху. */
  toMark: ScheduleLesson[];
  week: { planned: number; completed: number; noShow: number; cancelled: number };
};

/** Окно обзора: две недели назад — ради неотмеченных уроков, неделя вперёд — ради ближайших. */
export const OVERVIEW_PAST_DAYS = 14;
export const OVERVIEW_AHEAD_DAYS = 7;

export function overviewRange(today: string): { from: string; to: string } {
  const week = weekDates(today);
  const to = addDays(today, OVERVIEW_AHEAD_DAYS);
  return { from: addDays(today, -OVERVIEW_PAST_DAYS), to: (week.at(-1) ?? to) > to ? (week.at(-1) ?? to) : to };
}

export function liveOverview(lessons: ScheduleLesson[], today: string, now: string): LiveOverview {
  const sorted = [...lessons].sort(compareLessons);
  const scheduled = sorted.filter((lesson) => lesson.status === undefined || lesson.status === "scheduled");
  const week = new Set(weekDates(today));
  const thisWeek = sorted.filter((lesson) => week.has(lesson.date));
  const count = (status: ScheduleLesson["status"]) => thisWeek.filter((lesson) => lesson.status === status).length;
  return {
    today: scheduled.filter((lesson) => lesson.date === today && !isPast(lesson, today, now)),
    tomorrow: scheduled.filter((lesson) => lesson.date === addDays(today, 1)),
    toMark: scheduled.filter((lesson) => isPast(lesson, today, now)).reverse(),
    week: { planned: count("scheduled"), completed: count("completed"), noShow: count("no_show"), cancelled: count("cancelled") },
  };
}
