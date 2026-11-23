import type { StudentDetails, Student } from "../mocks/types";
import { homeworkSummary } from "./studentTasks";
import { paymentStatus } from "./students";

/** Что по ученику требует действия репетитора — по важности: деньги, домашки, связь, расписание. */
export type StudentAlert =
  | { kind: "debt"; amount: number }
  | { kind: "packageLow"; left: number }
  | { kind: "overdue"; count: number }
  | { kind: "review"; count: number }
  | { kind: "telegram" }
  | { kind: "noSchedule" };

export function studentAlerts(student: Student, details: Pick<StudentDetails, "tasks">, today: string): StudentAlert[] {
  const alerts: StudentAlert[] = [];
  const payment = paymentStatus(student);
  if (payment === "debt") alerts.push({ kind: "debt", amount: -student.balance });
  if (payment === "low") alerts.push({ kind: "packageLow", left: student.payment.package?.left ?? 0 });
  const homework = homeworkSummary(details.tasks, today);
  if (homework.overdue > 0) alerts.push({ kind: "overdue", count: homework.overdue });
  if (homework.wait > 0) alerts.push({ kind: "review", count: homework.wait });
  if (!student.telegramConnected) alerts.push({ kind: "telegram" });
  if (student.status === "active" && student.schedule.timesPerWeek === 0) alerts.push({ kind: "noSchedule" });
  return alerts;
}
