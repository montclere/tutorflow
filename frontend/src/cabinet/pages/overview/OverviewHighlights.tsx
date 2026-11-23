import { CalendarDays, ClipboardCheck, Clock3 } from "lucide-react";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import type { TeacherOverview } from "../../mocks/types";
import { useLibrary } from "../../tasks/library";
import { CabinetLink } from "../../ui/CabinetLink";
import styles from "./overview.module.css";

const text = cabinet.teacher.overview.stats;

export function OverviewHighlights({ data }: { data: TeacherOverview }) {
  const waiting = useLibrary().assignments.filter((assignment) => assignment.status === "wait").length;
  const left = data.today.filter((row) => !row.past).length;
  const metrics = [
    { label: text.today, value: data.today.length, note: text.todayNote(left), icon: CalendarDays, href: teacherRoutes.schedule },
    { label: text.review, value: waiting, note: text.reviewNote, icon: ClipboardCheck, href: teacherRoutes.review },
    { label: text.windows, value: data.week.freeWindows.length, note: text.windowsNote, icon: Clock3, href: teacherRoutes.schedule },
  ];
  return <div className={styles.metrics}>{metrics.map(({ label, value, note, icon: Icon, href }) => <CabinetLink key={label} href={href} className={styles.metric}><span className={styles.metricIcon}><Icon aria-hidden="true" /></span><span><span className={styles.metricLabel}>{label}</span><span className={styles.metricValue}><b>{value}</b><small>/ {note}</small></span></span></CabinetLink>)}</div>;
}
