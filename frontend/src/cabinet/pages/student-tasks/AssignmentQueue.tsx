import { ArrowRight, Layers } from "lucide-react";
import type { StudentAssignmentEntry } from "../../model/studentAssignments";
import { tasksText } from "../../tasks/tasks.ru";
import { AssignmentDue, AssignmentIcon, AssignmentNotes, AssignmentStatus } from "./AssignmentParts";
import styles from "./student-tasks.module.css";

const text = tasksText.student;

export function AssignmentQueue({ entries, onOpen }: { entries: StudentAssignmentEntry[]; onOpen: (entry: StudentAssignmentEntry) => void }) {
  return <section className={styles.queue} aria-labelledby="student-task-queue">
    <h2 id="student-task-queue"><Layers size={24} aria-hidden="true" />{text.page.queue}</h2>
    {entries.length === 0 ? <p className={styles.emptyText}>{text.page.queueEmpty}</p> : <ul className={styles.queueList}>
      {entries.map((entry) => {
        const { assignment, work, score } = entry;
        const canOpen = entry.startable && assignment.status !== "wait" && work.items.length > 0;
        const unavailable = work.items.length === 0 ? text.page.noItems : assignment.status === "wait" ? text.page.awaiting : assignment.status === "done" ? text.page.finished : text.page.exhausted;
        return <li key={assignment.id} className={styles.queueRow}>
          <AssignmentIcon entry={entry} />
          <div className={styles.queueInfo}><b>{work.title}</b><span>{tasksText.kinds[work.kind]} · {text.page.fromTeacher}</span><AssignmentNotes entry={entry} /></div>
          <AssignmentDue entry={entry} />
          <AssignmentStatus entry={entry} />
          <span className={styles.result}>{score && (score.percent !== null ? <span aria-label={text.page.result(score.percent)}>{score.percent}%</span> : tasksText.player.resultPoints(score.points, score.maxPoints))}</span>
          <button type="button" className={styles.open} aria-label={text.page.open(work.title)} disabled={!canOpen} title={canOpen ? text.page.open(work.title) : unavailable} onClick={() => onOpen(entry)}><ArrowRight size={21} aria-hidden="true" /></button>
        </li>;
      })}
    </ul>}
  </section>;
}
