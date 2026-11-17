import type { Ref } from "react";
import styles from "./wizard.module.css";

type ChipGroupProps<T extends string> = {
  labelId: string;
  label: string;
  options: readonly T[];
  labels: Record<T, string>;
  isSelected: (option: T) => boolean;
  onSelect: (option: T) => void;
  describedBy?: string;
  ref?: Ref<HTMLDivElement>;
};

export function ChipGroup<T extends string>({
  labelId,
  label,
  options,
  labels,
  isSelected,
  onSelect,
  describedBy,
  ref,
}: ChipGroupProps<T>) {
  return (
    <div className={styles.field}>
      <span id={labelId} className={styles.label}>
        {label}
      </span>
      <div ref={ref} className={styles.chips} role="group" aria-labelledby={labelId} aria-describedby={describedBy}>
        {options.map((option) => (
          <button
            key={option}
            type="button"
            className={styles.chip}
            aria-pressed={isSelected(option)}
            onClick={() => onSelect(option)}
          >
            {labels[option]}
          </button>
        ))}
      </div>
    </div>
  );
}
