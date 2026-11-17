import { cx } from "./cx";
import styles from "./ui.module.css";

type Props = { percent: number; danger?: boolean };

export function ProgressBar({ percent, danger }: Props) {
  return (
    <div className={styles.bar} role="presentation">
      <span className={cx(danger && styles.barDanger)} style={{ width: `${percent}%` }} />
    </div>
  );
}
