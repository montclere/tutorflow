import type { ReactNode } from "react";
import styles from "./ui.module.css";

type Props = { pressed?: boolean; onClick?: () => void; children: ReactNode };

export function Chip({ pressed = false, onClick, children }: Props) {
  return (
    <button type="button" className={styles.chip} aria-pressed={pressed} onClick={onClick}>
      {children}
    </button>
  );
}
