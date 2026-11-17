import { CabinetLink } from "./CabinetLink";
import styles from "./ui.module.css";

type Item = { id: string; label: string; href?: string };
type Props = { label: string; items: Item[]; selectedId: string; onSelect?: (id: string) => void };

export function Tabs({ label, items, selectedId, onSelect }: Props) {
  return (
    <div className={styles.tabs} role="tablist" aria-label={label}>
      {items.map((item) =>
        item.href ? (
          <CabinetLink key={item.id} href={item.href} role="tab" aria-selected={item.id === selectedId}>
            {item.label}
          </CabinetLink>
        ) : (
          <button key={item.id} type="button" role="tab" aria-selected={item.id === selectedId} onClick={() => onSelect?.(item.id)}>
            {item.label}
          </button>
        ),
      )}
    </div>
  );
}
