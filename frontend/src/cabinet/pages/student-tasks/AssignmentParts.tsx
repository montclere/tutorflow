import { CalendarDays, Check, Circle, ClipboardList, Hourglass, RotateCcw, Zap } from "lucide-react";
import type { StudentAssignmentEntry } from "../../model/studentAssignments";
import { formatShortDate } from "../../model/dates";
import { tasksText } from "../../tasks/tasks.ru";
import { cx } from "../../ui/cx";
import styles from "./student-tasks.module.css";

const text = tasksText.student;

export function AssignmentIcon({ entry }: { entry: StudentAssignmentEntry }) {
  const Icon = entry.work.kind === "test" ? Zap : ClipboardList;
  return <span className={cx(styles.icon, entry.work.kind === "test" ? styles.testIcon : styles.homeworkIcon)} aria-hidden="true"><Icon /></span>;
}

export function AssignmentStatus({ entry }: { entry: StudentAssignmentEntry }) {
  const { assignment } = entry;
  const returned = assignment.status === "todo" && assignment.returned;
  const retry = assignment.status === "todo" && assignment.attempts.length > 0;
  const Icon = returned || retry ? RotateCcw : assignment.status === "done" ? Check : assignment.status === "wait" ? Hourglass : Circle;
  return <span className={cx(styles.status, assignment.status === "done" && styles.done, assignment.status === "wait" && styles.wait, Boolean(returned) && styles.returned)}>
    <Icon size={16} aria-hidden="true" />{returned ? text.page.returnedStatus : retry ? text.page.retryStatus : text.status[assignment.status]}
  </span>;
}

export function AssignmentDue({ entry }: { entry: StudentAssignmentEntry }) {
  return <span className={cx(styles.due, entry.overdue && styles.overdue)}>
    <CalendarDays size={16} aria-hidden="true" /><time dateTime={entry.assignment.due}>{text.due(formatShortDate(entry.assignment.due))}</time>
    {entry.overdue && <span>{text.overdue}</span>}
  </span>;
}

export function AssignmentNotes({ entry }: { entry: StudentAssignmentEntry }) {
  const { assignment } = entry;
  if (assignment.status === "todo" && assignment.returned) return <p className={styles.note}>{text.returned(assignment.returned)}</p>;
  if (assignment.status === "done" && assignment.feedback && Object.values(assignment.feedback).some(Boolean)) return <p className={styles.note}><b>{text.feedback}:</b> {Object.values(assignment.feedback).join(" ")}</p>;
  return null;
}
