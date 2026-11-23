import { Tabs as KitTabs, TabsList, TabsTrigger } from "@/shared/ui/kit/tabs";
import { CabinetLink } from "./CabinetLink";
import styles from "./Tabs.module.css";

type Item = { id: string; label: string; href?: string; count?: number };
type Props = { label: string; items: Item[]; selectedId: string; onSelect?: (id: string) => void };

export function Tabs({ label, items, selectedId, onSelect }: Props) {
  return (
    <KitTabs value={selectedId} onValueChange={onSelect}>
      <TabsList aria-label={label} className={items.some((item) => item.count !== undefined) ? styles.statuses : undefined}>
        {items.map((item) =>
          item.href ? (
            <TabsTrigger key={item.id} value={item.id} asChild className={item.count !== undefined ? styles.status : undefined}>
              <CabinetLink href={item.href} aria-label={item.count !== undefined ? `${item.label}: ${item.count}` : undefined}>
                {item.label}
                {item.count !== undefined && <span className={styles.count} aria-hidden="true">{item.count}</span>}
              </CabinetLink>
            </TabsTrigger>
          ) : (
            <TabsTrigger key={item.id} value={item.id} className={item.count !== undefined ? styles.status : undefined} aria-label={item.count !== undefined ? `${item.label}: ${item.count}` : undefined}>
              {item.label}
              {item.count !== undefined && <span className={styles.count} aria-hidden="true">{item.count}</span>}
            </TabsTrigger>
          ),
        )}
      </TabsList>
    </KitTabs>
  );
}
