import styles from "./wizard.module.css";

const segments = [1, 2, 3];

export function ProgressBar({ value }: { value: number }) {
  return (
    <div className={styles.progress} aria-hidden="true">
      {segments.map((segment) => (
        <span key={segment} className={segment <= value ? styles.progressOn : undefined} />
      ))}
    </div>
  );
}
