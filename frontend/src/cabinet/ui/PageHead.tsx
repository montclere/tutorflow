import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { title: string; subtitle: string; actions?: ReactNode };

export function PageHead({ title, subtitle, actions }: Props) {
  return (
    <div className={styles.head}>
      <div>
        <h1 className={styles.headTitle}>{title}</h1>
        <p className={styles.headText}>{subtitle}</p>
      </div>
      {actions && <div className={styles.headActions}>{actions}</div>}
    </div>
  );
}
