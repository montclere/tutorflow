import { cabinet } from "../../content/cabinet.ru";
import type { FinanceOverview } from "../../mocks/types";
import { averageCheck, monthIndex } from "../../model/finance";
import { formatRubles } from "../../model/format";
import { cx } from "../../ui/cx";
import { Card } from "../../ui/Card";
import { Separator } from "@/shared/ui/kit/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

const text = cabinet.teacher.finance.chart;

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-bold text-muted-foreground">
      <span className="inline-flex items-center gap-1.5">
        <i className="size-2.5 rounded-sm bg-primary" aria-hidden="true" />
        {text.received}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <i className="size-2.5 rounded-sm bg-[var(--cab-chart-muted)]" aria-hidden="true" />
        {text.earned}
      </span>
    </div>
  );
}

type Props = { data: FinanceOverview; onPick: (month: string) => void };

export function IncomeChart({ data, onPick }: Props) {
  const max = Math.max(...data.history.flatMap((item) => [item.received, item.earned]), 1);
  const height = (value: number) => `${Math.max(2, Math.round((value / max) * 100))}%`;

  return (
    <Card title={text.title} action={<Legend />}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <div className="flex h-56 items-stretch gap-2 sm:gap-3" role="group" aria-label={text.label}>
          {data.history.map((item) => {
            const selected = item.month === data.month;
            const label = text.months[monthIndex(item.month)] ?? item.month;
            return (
              <Tooltip key={item.month}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label={text.openMonth(label)}
                    aria-pressed={selected}
                    onClick={() => onPick(item.month)}
                    className={cx(
                      "flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg border-0 bg-transparent px-1 pt-2 pb-1.5 transition-colors duration-150 outline-none hover:bg-secondary focus-visible:ring-[3px] focus-visible:ring-ring/40 active:bg-accent motion-reduce:transition-none",
                      selected && "bg-accent hover:bg-accent",
                    )}
                  >
                    <span className="flex w-full flex-1 items-end justify-center gap-1" aria-hidden="true">
                      <span className="w-full max-w-7 rounded-t-md bg-primary" style={{ height: height(item.received) }} />
                      <span className="w-full max-w-7 rounded-t-md bg-[var(--cab-chart-muted)]" style={{ height: height(item.earned) }} />
                    </span>
                    <span className={cx("text-xs", selected ? "font-extrabold text-primary" : "font-bold text-muted-foreground")}>{label}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <span className="grid gap-0.5 tabular-nums">
                    <b>{label}</b>
                    <span>
                      {text.received}: {formatRubles(item.received)}
                    </span>
                    <span>
                      {text.earned}: {formatRubles(item.earned)}
                    </span>
                  </span>
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
        <Separator />
        <p className="m-0 text-sm font-semibold text-muted-foreground tabular-nums">
          {data.stat
            ? text.summary(formatRubles(averageCheck(data.stat.earned, data.stat.lessons)), monthIndex(data.month), data.stat.lessons, data.stat.chargedCancellations)
            : text.empty}
        </p>
      </div>
    </Card>
  );
}
