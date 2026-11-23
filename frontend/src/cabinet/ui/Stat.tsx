import type { StatData } from "../mocks/types";
import { Card } from "@/shared/ui/kit/card";
import { cx } from "./cx";

export function Stat({ label, value, note, highlight }: StatData) {
  return (
    <Card className={cx("gap-1.5 px-5", highlight && "border-primary bg-primary text-primary-foreground")}>
      <span className={cx("text-xs font-bold", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}>{label}</span>
      <span className="font-[family-name:var(--font-display)] text-3xl leading-none font-black tracking-tight tabular-nums max-[520px]:text-xl">{value}</span>
      <span className={cx("text-xs font-bold", highlight ? "text-primary-foreground/80" : "text-muted-foreground")}>{note}</span>
    </Card>
  );
}

export function StatGrid({ stats, columns }: { stats: StatData[]; columns: 3 | 4 }) {
  return (
    <div className={cx("grid gap-4", columns === 4 ? "grid-cols-4 max-[1180px]:grid-cols-2" : "grid-cols-3 max-[820px]:grid-cols-1")}>
      {stats.map((stat) => (
        <Stat key={stat.label} {...stat} />
      ))}
    </div>
  );
}
