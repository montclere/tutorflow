import { Info } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { FinanceOverview } from "../../mocks/types";
import { monthIndex, shiftMonth } from "../../model/finance";
import { formatRubles } from "../../model/format";
import { cx } from "../../ui/cx";
import { Card } from "@/shared/ui/kit/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

const text = cabinet.teacher.finance.tiles;

type TileProps = { label: string; hint: string; value: string; note: string; valueClass?: string; noteClass?: string };

function Tile({ label, hint, value, note, valueClass, noteClass }: TileProps) {
  return (
    <Card className="gap-2 px-5">
      <div className="flex min-h-8 items-start justify-between gap-2">
        <span className="min-w-0 text-xs font-bold text-muted-foreground">{label}</span>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${text.hintLabel}: ${label}`}
              className="grid size-6 flex-none place-items-center rounded-md border-0 bg-transparent text-muted-foreground transition-colors duration-150 outline-none hover:bg-secondary hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/40 active:bg-accent motion-reduce:transition-none"
            >
              <Info size={15} aria-hidden="true" />
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-60">{hint}</TooltipContent>
        </Tooltip>
      </div>
      <b className={cx("font-[family-name:var(--font-display)] text-2xl leading-none font-black tracking-tight tabular-nums max-[520px]:text-xl", valueClass)}>{value}</b>
      <span className={cx("text-xs font-bold text-muted-foreground tabular-nums", noteClass)}>{note}</span>
    </Card>
  );
}

export function MoneyTiles({ data }: { data: FinanceOverview }) {
  const growth = data.receivedGrowth;
  const growthNote = growth === null ? text.noGrowth : text.growth(growth, monthIndex(shiftMonth(data.month, -1)));
  const growthClass = growth === null || growth === 0 ? undefined : growth > 0 ? "text-success" : "text-destructive";

  return (
    <div className="grid grid-cols-4 gap-4 max-[1180px]:grid-cols-2">
      <Tile {...text.received} value={formatRubles(data.stat?.received ?? 0)} note={growthNote} noteClass={growthClass} />
      <Tile {...text.expected} value={formatRubles(data.expected.amount)} note={text.expectedNote(data.expected.lessons)} />
      <Tile {...text.debt} value={formatRubles(data.debt.amount)} note={text.debtNote(data.debt.count)} valueClass={data.debt.amount > 0 ? "text-destructive" : undefined} />
      <Tile {...text.prepaid} value={formatRubles(data.prepaid.amount)} note={text.prepaidNote(data.prepaid.lessons)} />
    </div>
  );
}
