import { Infinity as InfinityIcon, Play, Printer } from "lucide-react";
import type { StudentAssignmentEntry } from "../../model/studentAssignments";
import type { Assignment, Work } from "../../tasks/library";
import { tasksText } from "../../tasks/tasks.ru";
import { cx } from "../../ui/cx";
import { AssignmentDue, AssignmentIcon, AssignmentNotes, AssignmentStatus } from "./AssignmentParts";
import styles from "./student-tasks.module.css";

const text = tasksText.student;

export function AssignmentCard({ entry, onOpen, onPrint }: { entry: StudentAssignmentEntry; onOpen: () => void; onPrint?: (work: Work, assignment: Assignment) => void }) {
  const { assignment, work } = entry;
  const test = work.kind === "test";
  const canOpen = entry.startable && assignment.status !== "wait" && work.items.length > 0;
  const limit = work.test?.attempts ?? null;
  return <article className={cx(styles.card, test ? styles.testCard : styles.homeworkCard)} aria-label={work.title}>
    <div className={styles.cardHead}>
      <AssignmentIcon entry={entry} />
      <div className={styles.cardInfo}>
        <h2>{work.title}</h2>
        <p className={styles.meta}>{tasksText.kinds[work.kind]}{test && work.test ? ` · ${tasksText.save.modes[work.test.mode]}` : ""} · {text.tasksCount(work.items.length)}</p>
        <AssignmentDue entry={entry} />
        <AssignmentStatus entry={entry} />
      </div>
    </div>
    <AssignmentNotes entry={entry} />
    <div className={styles.cardFooter}>
      <div className={styles.actions}>
        {canOpen && <button type="button" className={cx(styles.primary, test && styles.lime)} onClick={onOpen}><Play size={19} aria-hidden="true" />{assignment.attempts.length > 0 ? text.again : test ? text.page.start : text.start.homework}</button>}
        {work.kind === "homework" && onPrint && assignment.status === "todo" && work.items.length > 0 && <button type="button" className={styles.secondary} onClick={() => onPrint(work, assignment)}><Printer size={19} aria-hidden="true" />{text.print}</button>}
      </div>
      {test && <span className={styles.attempts}>{limit === null && <InfinityIcon size={20} aria-hidden="true" />}{limit === null ? text.page.unlimited : text.page.attempts(assignment.attempts.length, limit)}</span>}
      {!canOpen && <span className={styles.blocked}>{work.items.length === 0 ? text.page.noItems : assignment.status === "wait" ? text.page.awaiting : text.page.exhausted}</span>}
    </div>
  </article>;
}
