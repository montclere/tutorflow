import { cx } from "../../ui/cx";
import styles from "./learn.module.css";

export type ChunkyTone = "primary" | "lime" | "good" | "bad" | "ghost";

/** Классы объёмной кнопки «как в Duolingo». */
export function chunky(tone: ChunkyTone = "primary", className?: string): string {
  return cx(styles.chunky, styles[tone], className);
}
