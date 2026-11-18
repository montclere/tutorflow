import { Plus } from "lucide-react";
import type { CSSProperties, MouseEvent } from "react";
import { cabinet } from "../../content/cabinet.ru";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;

type Props = { label: string; style: CSSProperties; onCreate: (fraction: number) => void };

/** Доля высоты окна, где кликнули; с клавиатуры (detail = 0) — начало окна. */
function clickFraction(event: MouseEvent<HTMLButtonElement>): number {
  if (event.detail === 0) return 0;
  const rect = event.currentTarget.getBoundingClientRect();
  return (event.clientY - rect.top) / rect.height;
}

/** Свободное окно видно всегда и открывает панель «Новый урок» со временем по месту клика (SCHEDULE-1, SCHEDULE-4). */
export function FreeSlot({ label, style, onCreate }: Props) {
  return (
    <button type="button" className={styles.free} style={style} aria-label={label} onClick={(event) => onCreate(clickFraction(event))}>
      <Plus size={14} aria-hidden="true" />
      {text.free}
    </button>
  );
}
