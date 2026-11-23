import { CalendarDays, Circle, Zap } from "lucide-react";
import { useState } from "react";
import { studentRoutes } from "../../../config/routes";
import { getSchedule } from "../../data";
import { demoStudentId } from "../../mocks/student";
import { formatShortDate } from "../../model/dates";
import { studentAssignmentsOverview } from "../../model/studentAssignments";
import { useLibrary, type Assignment, type Work } from "../../tasks/library";
import { tasksText } from "../../tasks/tasks.ru";
import { CabinetLink } from "../../ui/CabinetLink";
import { cx } from "../../ui/cx";
import { AssignmentCard } from "../student-tasks/AssignmentCard";
import { AssignmentQueue } from "../student-tasks/AssignmentQueue";
import styles from "../student-tasks/student-tasks.module.css";
import { TaskPlayer } from "./player/TaskPlayer";

const text = tasksText.student;
type Props = { onPrint?: (work: Work, assignment: Assignment) => void };

/** STUDENT-TASKS-UI-1/2: новый список поверх прежней библиотеки, плеера и печати. */
export function StudentAssignments({ onPrint }: Props) {
  const { works, assignments } = useLibrary();
  const [openId, setOpenId] = useState<string | null>(null);
  const overview = studentAssignmentsOverview(demoStudentId, assignments, works, getSchedule().today);
  const current = overview.entries.find((entry) => entry.assignment.id === openId);
  return <div className={styles.root}>
    <header className={styles.header}>
      <div className={styles.heading}><h1>{text.page.title}</h1><p>{text.page.subtitle}</p></div>
      <dl className={styles.metrics} aria-label={text.page.metrics}>
        {[
          { icon: Zap, label: text.page.active, value: overview.active, tone: styles.activeMetric },
          { icon: CalendarDays, label: text.page.deadline, value: overview.deadline ? formatShortDate(overview.deadline) : "—", tone: styles.deadlineMetric },
          { icon: Circle, label: text.page.notStarted, value: overview.notStarted, tone: styles.notStartedMetric },
        ].map((item) => <div key={item.label} className={cx(styles.metric, item.tone)}><item.icon size={21} aria-hidden="true" /><dt>{item.label}</dt><dd data-empty={item.value === "—" || undefined}>{item.value}</dd></div>)}
      </dl>
      <picture className={styles.art}>
        <source srcSet="/student-tasks/checklist-600.webp 600w, /student-tasks/checklist.webp 1000w" sizes="(max-width: 1279px) 260px, 350px" type="image/webp" />
        <img src="/student-tasks/checklist.webp" width="1000" height="667" alt="" decoding="async" />
      </picture>
    </header>
    {overview.leading.length > 0 ? <section className={styles.leading} aria-label={text.page.leading}>
      {overview.leading.map((entry) => <AssignmentCard key={entry.assignment.id} entry={entry} onOpen={() => setOpenId(entry.assignment.id)} onPrint={onPrint} />)}
    </section> : <section className={styles.empty} aria-label={text.page.leading}>
      <h2>{overview.entries.length > 0 ? text.page.allDone : text.empty}</h2>
      <p>{overview.entries.length > 0 ? text.page.noActive : text.page.empty}</p>
      <CabinetLink className={styles.primary} href={studentRoutes.trainer}>{text.page.trainer}</CabinetLink>
    </section>}
    <AssignmentQueue entries={overview.entries} onOpen={(entry) => setOpenId(entry.assignment.id)} />
    <TaskPlayer assignment={current?.assignment ?? null} work={current?.work ?? null} onClose={() => setOpenId(null)} />
  </div>;
}
