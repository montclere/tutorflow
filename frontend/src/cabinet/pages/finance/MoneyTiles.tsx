import { cabinet } from "../../content/cabinet.ru";
import type { FinanceOverview } from "../../mocks/types";
import { monthIndex, shiftMonth } from "../../model/finance";
import { formatRubles } from "../../model/format";
import { cx } from "../../ui/cx";
import { Badge } from "@/shared/ui/kit/badge";
import { Card } from "@/shared/ui/kit/card";

const received = cabinet.teacher.finance.received;
const tiles = cabinet.teacher.finance.tiles;
const monthNames = cabinet.teacher.finance.monthNames;

type TileProps = { label: string; value: string; note: string; valueClass?: string; className?: string };

function Tile({ label, value, note, valueClass, className }: TileProps) {
  return (
    <Card className={cx("justify-center gap-1 px-5 py-4", className)}>
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <b className={cx("font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight tabular-nums", valueClass)}>{value}</b>
      <span className="text-sm font-semibold text-muted-foreground tabular-nums">{note}</span>
    </Card>
  );
}

function Growth({ percent, month }: { percent: number; month: string }) {
  const text = received.growth(percent, monthIndex(shiftMonth(month, -1)));
  return percent >= 0 ? (
    <Badge variant="highlight" className="px-3 py-1 text-sm tabular-nums">
      {text}
    </Badge>
  ) : (
    <span className="inline-flex rounded-full bg-white/15 px-3 py-1 text-sm font-bold tabular-nums">{text}</span>
  );
}

export function MoneyTiles({ data }: { data: FinanceOverview }) {
  const stat = data.stat;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className="justify-between gap-6 border-transparent bg-primary px-6 py-6 text-primary-foreground">
        <span className="text-base font-bold text-white/80">{received.title(monthNames[monthIndex(data.month)] ?? "")}</span>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
          <b className="font-[family-name:var(--font-display)] text-5xl leading-none font-black tracking-tight tabular-nums max-[520px]:text-4xl">
            {formatRubles(stat?.received ?? 0)}
          </b>
          {data.receivedGrowth !== null && <Growth percent={data.receivedGrowth} month={data.month} />}
        </div>
        {stat && <span className="text-sm font-semibold text-white/75 tabular-nums">{received.summary(stat.payments, stat.lessons)}</span>}
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Tile label={tiles.expected.label} value={formatRubles(data.expected.amount)} note={tiles.expected.note} />
        <Tile
          label={tiles.debt.label}
          value={formatRubles(data.debt.amount)}
          note={tiles.debt.note(data.debt.count)}
          valueClass={data.debt.amount > 0 ? "text-destructive" : undefined}
          className={data.debt.amount > 0 ? "border-destructive" : undefined}
        />
        <Tile label={tiles.prepaid.label} value={formatRubles(data.prepaid.amount)} note={tiles.prepaid.note(data.prepaid.lessons)} />
      </div>
    </div>
  );
}
