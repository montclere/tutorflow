import { Lines } from "./Lines";
import styles from "./SectionHeading.module.css";

type SectionHeadingProps = { id: string; lines: readonly string[]; subtitle?: string };

export function SectionHeading({ id, lines, subtitle }: SectionHeadingProps) {
  return (
    <div className={styles.head}>
      <h2 id={id} className={styles.title}>
        <Lines lines={lines} />
      </h2>
      {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
    </div>
  );
}
