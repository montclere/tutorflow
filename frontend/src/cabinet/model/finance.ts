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

/**
 * Ожидаемый приход: предстоящие поурочные уроки месяца по цене урока плюс текущие долги.
 * Уроки из абонементов не считаются (priceOf возвращает null) — они уже оплачены.
 * Долги добавляются только к текущему месяцу: в прошлых и будущих они не «ожидаются».
 */
export function expectedIncome(
  lessons: ScheduleLesson[],
  priceOf: (studentId: string) => number | null,
  month: string,
  today: string,
  now: string,
  debt: number,
): { amount: number; lessons: number } {
  let amount = 0;
  let count = 0;
  for (const lesson of lessons) {
    if (monthKeyOf(lesson.date) !== month || isPast(lesson, today, now)) continue;
    const price = priceOf(lesson.studentId);
    if (price === null) continue;
    amount += price;
    count += 1;
  }
  return { amount: amount + (month === monthKeyOf(today) ? debt : 0), lessons: count };
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

export type StudentIncome = { studentId: string; amount: number; payments: number };

/** Кто сколько заплатил за месяц — по убыванию; учитываются только оплаты. */
export function incomeByStudent(operations: FinanceOperation[]): StudentIncome[] {
  const byStudent = new Map<string, StudentIncome>();
  for (const operation of operations) {
    if (operation.kind !== "payment" || operation.amount <= 0) continue;
    const current = byStudent.get(operation.studentId) ?? { studentId: operation.studentId, amount: 0, payments: 0 };
    byStudent.set(operation.studentId, { ...current, amount: current.amount + operation.amount, payments: current.payments + 1 });
  }
  return [...byStudent.values()].sort((a, b) => b.amount - a.amount);
}

/** Способ оплаты по подписи записи «Оплата · СБП». */
export function methodOfTitle(title: string): FinanceOperation["method"] {
  if (/сбп/i.test(title)) return "sbp";
  if (/налич/i.test(title)) return "cash";
  if (/перевод/i.test(title)) return "transfer";
  return null;
}
