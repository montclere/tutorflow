import { Badge } from "@/shared/ui/kit/badge";
import { cabinet } from "../../content/cabinet.ru";
import { barHeightPercent, weekLoadPercent, weekTotal } from "../../model/week";
import type { WeekPlan } from "../../mocks/types";
import { CabinetLink } from "../../ui/CabinetLink";
import { cx } from "../../ui/cx";
import { scheduleHref } from "../schedule/useScheduleUrl";
import { OverviewSection } from "./OverviewSection";
import styles from "./overview.module.css";

const text = cabinet.teacher.overview.week;

export function WeekCard({ week, today }: { week: WeekPlan; today: string }) {
  const total = weekTotal(week.days);
  return <OverviewSection title={text.title} action={<Badge className="bg-[var(--main-highlight)] text-primary">{text.load(weekLoadPercent(week.days, week.capacity))}</Badge>}>
    <p className={styles.weekTotal}><strong>{total}</strong><span>{text.lessons(total)}</span></p>
    <ol className={styles.chart} aria-label={text.chartLabel}>{week.days.map(day => <li key={day.date}>
      <CabinetLink href={scheduleHref("day", day.date, today)} className={styles.barLink} aria-label={text.barLabel(day.label, day.lessons)}>
        <span aria-hidden="true">{day.lessons}</span>
        <span className={cx(styles.bar, day.today && styles.barToday)} style={{ height: `${barHeightPercent(day.lessons, week.days) * 0.65}%` }} aria-hidden="true" />
        <span aria-hidden="true">{day.label}</span>
      </CabinetLink>
    </li>)}</ol>
  </OverviewSection>;
}
