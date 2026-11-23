import styles from "./tasks.module.css";

export function StudyHeading({ title }: { title: string }) {
  return <header className={styles.heading}><h1>{title}<svg viewBox="0 0 180 18" preserveAspectRatio="none" aria-hidden="true"><path d="m2 12 62-9-23 12 89-10-27 11 73-5" /></svg></h1></header>;
}
