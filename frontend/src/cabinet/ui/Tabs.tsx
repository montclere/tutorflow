import { Tabs as KitTabs, TabsList, TabsTrigger } from "@/shared/ui/kit/tabs";
import { CabinetLink } from "./CabinetLink";

type Item = { id: string; label: string; href?: string };
type Props = { label: string; items: Item[]; selectedId: string; onSelect?: (id: string) => void };

export function Tabs({ label, items, selectedId, onSelect }: Props) {
  return (
    <KitTabs value={selectedId} onValueChange={onSelect}>
      <TabsList aria-label={label}>
        {items.map((item) =>
          item.href ? (
            <TabsTrigger key={item.id} value={item.id} asChild>
              <CabinetLink href={item.href}>{item.label}</CabinetLink>
            </TabsTrigger>
          ) : (
            <TabsTrigger key={item.id} value={item.id}>
              {item.label}
            </TabsTrigger>
          ),
        )}
      </TabsList>
    </KitTabs>
  );
}
