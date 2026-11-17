import type { AvatarTone } from "../mocks/types";
import { cx } from "./cx";
import styles from "./ui.module.css";

export function Avatar({ initials, tone }: { initials: string; tone: AvatarTone }) {
  return (
    <span className={cx(styles.avatar, styles[`tone-${tone}`])} aria-hidden="true">
      {initials}
    </span>
  );
}
