import type { ReactNode } from "react";
import type { Tone } from "../mocks/types";
import { cx } from "./cx";
import styles from "./ui.module.css";

export function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={cx(styles.pill, styles[`pill-${tone}`])}>{children}</span>;
}
