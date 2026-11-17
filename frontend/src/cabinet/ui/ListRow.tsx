import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { title: ReactNode; note?: ReactNode; lead?: ReactNode; children?: ReactNode };

export function ListRow({ title, note, lead, children }: Props) {
  return (
    <div className={styles.row}>
      {lead}
      <div className={styles.rowGrow}>
        <b>{title}</b>
        {note && <span>{note}</span>}
      </div>
      {children}
    </div>
  );
}
