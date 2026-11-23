import { Target, TrendingUp, Trophy } from "lucide-react";
import type { StudentProgress } from "../../tasks/progress";
import { Ring } from "../learn/Ring";
import { learnText } from "../learn/learn.ru";
import styles from "./student-progress.module.css";

const text = learnText.progress;

export function ProgressSummary({ progress }: { progress: StudentProgress }) {
  const last = progress.trend.at(-1);
  return <section className={styles.summary} aria-label={progress.mode === "exam" ? text.examTitle(progress.title) : text.topicsTitle(progress.title)}>
    <div className={styles.ring}>
      <Ring value={progress.readiness} size={154} stroke={15} tone="var(--cab-tone-lilac-strong)" track="var(--vibe-lavender)" label={text.readinessLabel(progress.readiness)}>
        <span className={styles.ringLabel}><b>{progress.readiness}%</b><span>{learnText.home.readiness}</span></span>
      </Ring>
    </div>
    <div className={styles.summaryBody}>
      <div className={styles.summaryHeading}>
        <h2>{progress.mode === "exam" ? text.examTitle(progress.title) : text.topicsTitle(progress.title)}</h2>
        {progress.forecast && <p><b>{learnText.home.forecast(progress.forecast.score, progress.forecast.max)}</b><span> · {text.forecastNote}</span></p>}
      </div>
      <div className={styles.facts}>
        {[
          { icon: Trophy, label: text.mastered, value: String(progress.mastered), note: text.masteredNote(progress.units.length) },
          { icon: Target, label: text.accuracy, value: progress.accuracy === null ? "—" : `${progress.accuracy}%`, note: text.accuracyNote },
          { icon: TrendingUp, label: text.trendTitle, value: last ? `${last.percent}%` : "—", note: last?.title ?? text.trendEmpty },
        ].map(item => <div key={item.label} className={styles.fact}>
          <span className={styles.factIcon} aria-hidden="true"><item.icon size={24} /></span>
          <div className={styles.factText}><span>{item.label}</span><b>{item.value}</b><span title={item.note}>{item.note}</span></div>
        </div>)}
      </div>
    </div>
    <picture className={styles.art}>
      <source srcSet="/student-progress/trophy-600.webp 600w, /student-progress/trophy.webp 1000w" sizes="(max-width: 1399px) 170px, 220px" type="image/webp" />
      <img src="/student-progress/trophy.webp" width="1000" height="1062" alt="" decoding="async" />
    </picture>
  </section>;
}
