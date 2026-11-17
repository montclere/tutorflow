import type { LessonRow, ScheduleLesson, Student, WeekDay } from "../mocks/types";
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
    return { label, lessons: lessonsOn(lessons, date).length, today: date === today };
  });
}
