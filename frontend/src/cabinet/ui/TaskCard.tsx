import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { badge: ReactNode; tools: ReactNode; question: ReactNode; answer?: string; source: string };

export function TaskCard({ badge, tools, question, answer, source }: Props) {
  return (
    <div className={styles.task}>
      <div className={styles.taskMeta}>
        {badge}
        <div className={styles.tools}>{tools}</div>
      </div>
      <div className={styles.taskQuestion}>{question}</div>
      {answer && <div className={styles.taskAnswer}>{answer}</div>}
      <div className={styles.taskSource}>{source}</div>
    </div>
  );
}

export function ToolButton({ label, onClick, children }: { label?: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}
