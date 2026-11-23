import { ChartColumn } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import { addDays, formatRange, formatShortDate } from "../../model/dates";
import { weeklyProgress } from "../../model/studentProgressView";
import type { HomeworkPoint } from "../../model/studentTasks";
import { learnText } from "../learn/learn.ru";
import styles from "./student-progress.module.css";

const text = learnText.progress;
const axis = [100, 75, 50, 25, 0];

export function WeeklyResults({ points }: { points: HomeworkPoint[] }) {
  const weeks = weeklyProgress(points);
  return <section className={styles.card} aria-labelledby="progress-weekly-results">
    <div className={styles.sectionTitle}><ChartColumn size={25} aria-hidden="true" /><div><h2 id="progress-weekly-results">{text.trendTitle}</h2><p>{text.trendHint}</p></div></div>
    {weeks.length === 0 ? <div className={styles.chartEmpty}><p>{text.trendEmpty}</p></div> : <div className={styles.chart}>
      <div className={styles.axis} aria-hidden="true">{axis.map(value => <span key={value} style={{ bottom: `${value}%` }}>{value}%</span>)}</div>
      <div className={styles.plot}>
        {axis.map(value => <span className={styles.gridLine} key={value} style={{ bottom: `${value}%` }} aria-hidden="true" />)}
        <ol className={styles.bars} aria-label={text.weeklyLabel}>
          {weeks.map(week => {
            const detail = text.weekDetail(formatRange(week.week, addDays(week.week, 6)), week.percent, week.correct, week.total, week.works);
            return <li key={week.week}><Tooltip><TooltipTrigger asChild><button type="button" className={styles.barButton} aria-label={detail}>
              <span className={styles.bar} style={{ height: `${week.percent}%` }} aria-hidden="true" />
              <span className={styles.barValue} style={{ bottom: `${week.percent}%` }} aria-hidden="true">{week.percent}%</span>
            </button></TooltipTrigger><TooltipContent className={styles.tooltip}>{detail}</TooltipContent></Tooltip>
              <span className={styles.week} title={text.weekLabel(formatShortDate(week.week))}>{formatShortDate(week.week)}</span>
            </li>;
          })}
        </ol>
      </div>
    </div>}
  </section>;
}
