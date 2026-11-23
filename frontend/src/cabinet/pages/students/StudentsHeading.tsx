import type { ReactNode } from "react";
import styles from "./students.module.css";

export function StudentsHeading({ title, actions }: { title: string; actions: ReactNode }) {
  return <header className={styles.heading}><h1>{title}</h1><div className={styles.headingActions}>{actions}</div></header>;
}
