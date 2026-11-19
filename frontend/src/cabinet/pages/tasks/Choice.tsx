import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

/** Выбор одного из нескольких — сегментами. */
export function Choice<T extends string>({ label, value, items, onChange }: { label: string; value: T; items: { id: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <ToggleGroup type="single" value={value} spacing={1} aria-label={label} className="w-full gap-1 rounded-lg border bg-card p-1" onValueChange={(next) => next && onChange(next as T)}>
      {items.map((item) => (
        <ToggleGroupItem key={item.id} value={item.id} className="flex-1 px-2 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

export function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="text-xs font-semibold text-muted-foreground">{hint}</span>}
    </div>
  );
}
