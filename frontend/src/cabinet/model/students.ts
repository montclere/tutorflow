import type { LessonTemplate, NextLesson, PaymentStatus, ScheduleLesson, Student, StudentStatus } from "../mocks/types";
import { addDays, daysBetween, weekdayIndex } from "./dates";
import { nextLesson as nextScheduled } from "./lessons";

export type StudentFilter = { status: StudentStatus; query: string; debtorsOnly: boolean };

export const LOW_PACKAGE_LEFT = 1;

export function paymentStatus(student: Pick<Student, "balance" | "payment">): PaymentStatus {
  if (student.balance < 0) return "debt";
  const left = student.payment.package?.left;
  if (student.payment.model === "package" && left !== undefined && left <= LOW_PACKAGE_LEFT) return "low";
  return "paid";
}

export function filterStudents(students: Student[], filter: StudentFilter): Student[] {
  const query = filter.query.trim().toLowerCase();
  return students.filter((student) => {
    if (student.status !== filter.status) return false;
    if (filter.debtorsOnly && student.balance >= 0) return false;
    return query === "" || student.name.toLowerCase().includes(query);
  });
}

export function countByStatus(students: Student[]): Record<StudentStatus, number> {
  const counts: Record<StudentStatus, number> = { active: 0, pause: 0, archive: 0 };
  for (const student of students) counts[student.status] += 1;
  return counts;
}

export function deriveSchedule(studentId: string, templates: LessonTemplate[], weekdayLabels: string[], mixedTimeLabel: string): Student["schedule"] {
  const own = templates.filter((template) => template.studentId === studentId).sort((a, b) => a.weekday - b.weekday);
  if (own.length === 0) return { timesPerWeek: 0, days: [], time: "", durationMin: 0 };
  const starts = new Set(own.map((template) => template.start));
  return {
    timesPerWeek: own.length,
    days: own.map((template) => weekdayLabels[template.weekday] ?? ""),
    time: starts.size === 1 ? (own[0]?.start ?? "") : mixedTimeLabel,
    durationMin: own[0]?.durationMin ?? 0,
  };
}

export function nextLessonOf(studentId: string, lessons: ScheduleLesson[], today: string, now: string): NextLesson | null {
  const next = nextScheduled(
    lessons.filter((lesson) => lesson.studentId === studentId),
    today,
    now,
  );
  return next ? { date: next.date, start: next.start } : null;
}

export type NextLessonLabels = { today: string; tomorrow: string; weekdays: string[] };

export function formatNextLesson(next: NextLesson, today: string, labels: NextLessonLabels): string {
  const distance = daysBetween(today, next.date);
  if (distance === 0) return `${labels.today} ${next.start}`;
  if (distance === 1) return `${labels.tomorrow} ${next.start}`;
  if (distance < 7) return `${labels.weekdays[weekdayIndex(next.date)] ?? ""} ${next.start}`;
  return `${labels.weekdays[weekdayIndex(next.date)] ?? ""} ${next.date.slice(8)}.${next.date.slice(5, 7)} ${next.start}`;
}

/**
 * Обычное расписание ученика по его регулярным урокам на ближайшую неделю — так в карточке
 * видно и расписание, поставленное через «Новый урок», а не только заранее заданное.
 */
export function templatesFromLessons(studentId: string, lessons: ScheduleLesson[], today: string): LessonTemplate[] {
  const weekEnd = addDays(today, 6);
  const seen = new Set<number>();
  const templates: LessonTemplate[] = [];
  for (const lesson of [...lessons].sort((a, b) => a.date.localeCompare(b.date))) {
    if (lesson.studentId !== studentId || !lesson.recurring || lesson.type === "trial") continue;
    if (lesson.date < today || lesson.date > weekEnd) continue;
    const weekday = weekdayIndex(lesson.date);
    if (seen.has(weekday)) continue;
    seen.add(weekday);
    templates.push({ id: lesson.id, studentId, weekday, start: lesson.start, durationMin: lesson.durationMin, type: lesson.type });
  }
  return templates;
}

export type HomeworkState = { state: "missing" } | { state: "done"; done: number; total: number } | null;

/** Последнее заданное ДЗ ученика: не сдано или сколько решено; null — ДЗ ещё не задавали. */
export function lastHomework(student: Pick<Student, "recentLessons">): HomeworkState {
  const lesson = [...student.recentLessons].sort((a, b) => b.date.localeCompare(a.date)).find((item) => item.homework);
  const homework = lesson?.homework;
  if (!homework) return null;
  return homework.done === null ? { state: "missing" } : { state: "done", done: homework.done, total: homework.total };
}

/** За сколько уроков долг — округляем вверх: даже часть урока — это урок, за который не заплатили. */
export function debtLessons(student: Pick<Student, "balance" | "payment">): number {
  const price = student.payment.pricePerLesson;
  return student.balance < 0 && price > 0 ? Math.ceil(-student.balance / price) : 0;
}
