import type { ReactNode } from "react";
import { cx } from "./cx";
import styles from "./ui.module.css";

type Props = {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
  scroll?: boolean;
};

export function Card({ title, subtitle, action, children, className, compact, scroll }: Props) {
  return (
    <section className={cx(styles.card, compact && styles.cardCompact, scroll && styles.tableWrap, className)}>
      {(title || action) && (
        <div className={styles.cardHead}>
          <div>
            {title && <h2 className={styles.cardTitle}>{title}</h2>}
            {subtitle && <p className={styles.cardSub}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}
