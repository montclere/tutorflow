import type { LessonTemplate, ScheduleLesson } from "../mocks/types";
import { addDays, daysBetween, weekdayIndex } from "./dates";
import { addMinutes, toMinutes } from "./time";

export type LessonFilters = { studentId: string | null; type: ScheduleLesson["type"] | null };

export function expandTemplates(templates: LessonTemplate[], from: string, to: string): ScheduleLesson[] {
  const lessons: ScheduleLesson[] = [];
  for (let offset = 0; offset <= daysBetween(from, to); offset += 1) {
    const date = addDays(from, offset);
    for (const template of templates) {
      if (template.weekday !== weekdayIndex(date)) continue;
      lessons.push({
        id: `${template.id}-${date}`,
        studentId: template.studentId,
        date,
        start: template.start,
        durationMin: template.durationMin,
        type: template.type,
        recurring: true,
        groupTitle: template.groupTitle,
      });
    }
  }
  return lessons;
}

export function compareLessons(a: ScheduleLesson, b: ScheduleLesson): number {
  return a.date.localeCompare(b.date) || toMinutes(a.start) - toMinutes(b.start);
}

export function lessonsOn(lessons: ScheduleLesson[], date: string): ScheduleLesson[] {
  return lessons.filter((lesson) => lesson.date === date).sort(compareLessons);
}

export function lessonsBetween(lessons: ScheduleLesson[], from: string, to: string): ScheduleLesson[] {
  return lessons.filter((lesson) => lesson.date >= from && lesson.date <= to).sort(compareLessons);
}

export function filterLessons(lessons: ScheduleLesson[], filters: LessonFilters): ScheduleLesson[] {
  return lessons.filter((lesson) => {
    if (filters.studentId && lesson.studentId !== filters.studentId) return false;
    if (filters.type && lesson.type !== filters.type) return false;
    return true;
  });
}

export function lessonEnd(lesson: ScheduleLesson): string {
  return addMinutes(lesson.start, lesson.durationMin);
}

export function isPast(lesson: ScheduleLesson, today: string, now: string): boolean {
  if (lesson.date !== today) return lesson.date < today;
  return toMinutes(lessonEnd(lesson)) <= toMinutes(now);
}

export type LessonPhase = "upcoming" | "live" | "ended";

/** Где урок относительно «сейчас»: от этого зависят действия в карточке урока (SCHEDULE-5). */
export function lessonPhase(lesson: ScheduleLesson, today: string, now: string): LessonPhase {
  if (isPast(lesson, today, now)) return "ended";
  if (lesson.date === today && toMinutes(lesson.start) <= toMinutes(now)) return "live";
  return "upcoming";
}

export function nextLesson(lessons: ScheduleLesson[], today: string, now: string): ScheduleLesson | null {
  return [...lessons].sort(compareLessons).find((lesson) => !isPast(lesson, today, now)) ?? null;
}

export function minutesUntil(lesson: ScheduleLesson, today: string, now: string): number {
  return daysBetween(today, lesson.date) * 1440 + toMinutes(lesson.start) - toMinutes(now);
}

export function groupByDate(lessons: ScheduleLesson[]): { date: string; lessons: ScheduleLesson[] }[] {
  const groups: { date: string; lessons: ScheduleLesson[] }[] = [];
  for (const lesson of [...lessons].sort(compareLessons)) {
    const last = groups.at(-1);
    if (last && last.date === lesson.date) last.lessons.push(lesson);
    else groups.push({ date: lesson.date, lessons: [lesson] });
  }
  return groups;
}
