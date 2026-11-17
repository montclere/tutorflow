import type { FinanceOperation, OperationKind, ScheduleLesson, Student } from "../mocks/types";
import { isPast } from "./lessons";

export type OperationFilter = OperationKind | "all";

export function monthKeyOf(date: string): string {
  return date.slice(0, 7);
}

export function shiftMonth(key: string, delta: number): string {
  const [year = 1970, month = 1] = key.split("-").map(Number);
  const index = year * 12 + (month - 1) + delta;
  return `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, "0")}`;
}

export function monthIndex(key: string): number {
  return Number(key.slice(5, 7)) - 1;
}

export function growthPercent(current: number, previous: number): number | null {
  return previous > 0 ? Math.round(((current - previous) / previous) * 100) : null;
}

export function averageCheck(earned: number, lessons: number): number {
  return lessons > 0 ? Math.round(earned / lessons) : 0;
}

export function expectedIncome(
  lessons: ScheduleLesson[],
  priceOf: (studentId: string) => number,
  month: string,
  today: string,
  now: string,
): { amount: number; lessons: number } {
  const planned = lessons.filter((lesson) => monthKeyOf(lesson.date) === month && !isPast(lesson, today, now));
  return { amount: planned.reduce((sum, lesson) => sum + priceOf(lesson.studentId), 0), lessons: planned.length };
}

export function lessonsAhead(student: Pick<Student, "balance" | "payment">): number {
  const price = student.payment.pricePerLesson;
  return student.balance > 0 && price > 0 ? Math.floor(student.balance / price) : 0;
}

export function filterOperations(
  operations: FinanceOperation[],
  filter: OperationFilter,
  query: string,
  nameOf: (studentId: string) => string,
): FinanceOperation[] {
  const needle = query.trim().toLowerCase();
  return operations.filter((operation) => {
    if (filter !== "all" && operation.kind !== filter) return false;
    return needle === "" || nameOf(operation.studentId).toLowerCase().includes(needle);
  });
}
