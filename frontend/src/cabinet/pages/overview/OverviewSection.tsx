import type { ReactNode } from "react";
import styles from "./overview.module.css";

export function OverviewSection({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return <section className={styles.section}><header className={styles.sectionHead}><h2>{title}</h2>{action}</header>{children}</section>;
}
