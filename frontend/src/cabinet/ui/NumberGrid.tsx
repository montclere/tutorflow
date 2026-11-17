import { cx } from "./cx";
import styles from "./ui.module.css";

export type NumberCell = { number: number; caption: string; level?: number; pressed?: boolean };
type Props = { cells: NumberCell[]; onPick: (number: number) => void };

export function NumberGrid({ cells, onPick }: Props) {
  return (
    <div className={styles.kim}>
      {cells.map((cell) => (
        <button
          key={cell.number}
          type="button"
          className={cx(styles.kimCell, cell.level !== undefined && styles[`level-${cell.level}`])}
          aria-pressed={cell.pressed ?? false}
          onClick={() => onPick(cell.number)}
        >
          {cell.number}
          <small>{cell.caption}</small>
        </button>
      ))}
    </div>
  );
}
