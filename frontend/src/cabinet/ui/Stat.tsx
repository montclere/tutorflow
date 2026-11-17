import type { StatData } from "../mocks/types";
import { cx } from "./cx";
import styles from "./ui.module.css";

export function Stat({ label, value, note, highlight }: StatData) {
  return (
    <div className={cx(styles.card, styles.stat, highlight && styles.statHighlight)}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statNote}>{note}</span>
    </div>
  );
}

export function StatGrid({ stats, columns }: { stats: StatData[]; columns: 3 | 4 }) {
  return (
    <div className={cx(styles.grid, columns === 4 ? styles.g4 : styles.g3)}>
      {stats.map((stat) => (
        <Stat key={stat.label} {...stat} />
      ))}
    </div>
  );
}
