import type { AttentionItem, AttentionKind, LessonRow, ScheduleLesson, Student, WeekDay } from "../mocks/types";
import { addDays, startOfWeek } from "./dates";
import { isPast, lessonsOn, minutesUntil } from "./lessons";
import { paymentStatus } from "./students";

const SOON_MINUTES = 60;

export function toLessonRow(lesson: ScheduleLesson, student: Student, today: string, now: string): LessonRow {
  const past = isPast(lesson, today, now);
  const minutes = minutesUntil(lesson, today, now);
  let status: LessonRow["status"] = paymentStatus(student) === "debt" ? "debt" : "paid";
  if (past) status = "done";
  else if (minutes <= SOON_MINUTES) status = "soon";
  return { id: lesson.id, time: lesson.start, studentId: lesson.studentId, goal: student.goal, status, minutes, past };
}

export function weekDays(lessons: ScheduleLesson[], today: string, labels: string[]): WeekDay[] {
  const start = startOfWeek(today);
  return labels.map((label, index) => {
    const date = addDays(start, index);
    return { label, date, lessons: lessonsOn(lessons, date).length, today: date === today };
  });
}

export type LessonMark = "none" | "toMark" | "marked";

/** Прошедший урок не считается проведённым сам: его нужно отметить (OVERVIEW-5). */
export function lessonMark(row: LessonRow, markedIds: readonly string[]): LessonMark {
  if (!row.past) return "none";
  return markedIds.includes(row.id) ? "marked" : "toMark";
}

export type AttentionDestination = { to: "review" } | { to: "markLesson" } | { to: "student"; studentId: string };

/** Куда ведёт пункт «Требует внимания» (OVERVIEW-7); null — объекта нет. */
export function attentionDestination(item: AttentionItem): AttentionDestination | null {
  if (item.kind === "review") return { to: "review" };
  if (item.kind === "lesson") return { to: "markLesson" };
  return item.studentId ? { to: "student", studentId: item.studentId } : null;
}

/** MAIN-2: финансовые напоминания остаются в финансах, счётчик — по видимым действиям. */
export function mainAttention(items: readonly AttentionItem[], hidden: readonly AttentionKind[], limit: number): AttentionItem[] {
  return items.filter(item => item.kind !== "debt" && !hidden.includes(item.kind)).slice(0, limit);
}
