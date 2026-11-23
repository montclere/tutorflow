import type { Assignment, Work } from "../tasks/library";
import type { Unit } from "../tasks/progress";

export type StudentHomeLesson = { id: string; studentId: string; date: string; start: string; subject: string; teacher: string; kind: "russian" | "math" };

export function mainStudentAssignment(studentId: string, assignments: Assignment[], works: Work[]): { assignment: Assignment; work: Work } | null {
  const candidates = assignments.filter((item) => item.studentId === studentId && item.status !== "done" && works.some((work) => work.id === item.workId));
  candidates.sort((a, b) => Number(a.status === "wait") - Number(b.status === "wait") || a.due.localeCompare(b.due));
  const assignment = candidates[0];
  const work = assignment && works.find((item) => item.id === assignment.workId);
  return assignment && work ? { assignment, work } : null;
}

export function upcomingStudentHomeLessons(studentId: string, lessons: StudentHomeLesson[], today: string, now: string): StudentHomeLesson[] {
  return lessons.filter((item) => item.studentId === studentId && (item.date > today || (item.date === today && item.start >= now))).sort((a, b) => a.date.localeCompare(b.date) || a.start.localeCompare(b.start));
}

/** Прежняя доля верных ответов слабой темы, без изменения расчёта прогресса. */
export function growthShare(unit: Pick<Unit, "correct" | "total">): number {
  return unit.total > 0 ? Math.round(unit.correct / unit.total * 100) : 0;
}
