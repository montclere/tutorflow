import { cabinet } from "../../content/cabinet.ru";
import type { MonthStat } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { monthIndex } from "../../model/finance";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

const text = cabinet.teacher.finance.income;
const short = cabinet.teacher.finance.monthShort;
const monthNames = cabinet.teacher.finance.monthNames;
const RUBLES_IN_THOUSAND = 100_000;

/** Шаг сетки — круглые тысячи, чтобы подписи читались: 0, 30, 60, 90 тыс. */
function niceStep(max: number): number {
  const raw = max / 3;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  const steps = [1, 2, 2.5, 5, 10];
  return (steps.find((step) => step * power >= raw) ?? 10) * power;
}

type Props = { history: MonthStat[]; month: string; currentMonth: string; expected: number; onPick: (month: string) => void };

/**
 * Столбики дохода за полгода: один ряд «получено»; у текущего месяца сверху — «ожидается» тем же цветом,
 * но светлее. Значение — в подсказке; подписан только выбранный месяц.
 */
export function IncomeChart({ history, month, currentMonth, expected, onPick }: Props) {
  const totals = history.map((item) => item.received + (item.month === currentMonth ? expected : 0));
  const step = niceStep(Math.max(...totals, 1));
  const top = step * Math.max(1, Math.ceil(Math.max(...totals) / step));
  const average = history.reduce((sum, item) => sum + item.received, 0) / Math.max(history.length, 1);
  const best = [...history].sort((a, b) => b.received - a.received)[0];
  const grid = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);

  return (
    <Card
      title={text.title}
      subtitle={text.hint}
      action={
        <ul className="m-0 flex list-none gap-3 p-0 text-xs font-bold text-muted-foreground" aria-label={text.legend}>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-primary" aria-hidden="true" />
            {text.received}
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-[3px] bg-primary/30" aria-hidden="true" />
            {text.expected}
          </li>
        </ul>
      }
    >
      <div className="grid gap-2">
        <div className="relative h-72">
          {grid.map((value) => (
            <span key={value} className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(value / top) * 100}%` }} aria-hidden="true">
              <span className="w-12 flex-none text-right text-xs font-semibold text-muted-foreground tabular-nums">{text.thousands(Math.round(value / RUBLES_IN_THOUSAND))}</span>
              <span className="h-px flex-1 bg-border/70" />
            </span>
          ))}
          <ol className="absolute inset-y-0 right-0 left-14 m-0 flex list-none items-end gap-3 p-0" aria-label={text.chartLabel}>
            {history.map((item) => {
              const extra = item.month === currentMonth ? expected : 0;
              const selected = item.month === month;
              const name = monthNames[monthIndex(item.month)] ?? item.month;
              const label = text.bar(name, formatRubles(item.received), extra > 0 ? formatRubles(extra) : null);
              return (
                <li key={item.month} className="relative flex h-full min-w-0 flex-1 justify-center">
                  {selected && (
                    <span className="absolute left-1/2 -translate-x-1/2 text-xs font-extrabold whitespace-nowrap tabular-nums" style={{ bottom: `calc(${((item.received + extra) / top) * 100}% + 6px)` }}>
                      {formatRubles(item.received)}
                    </span>
                  )}
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        aria-label={label}
                        aria-pressed={selected}
                        onClick={() => onPick(item.month)}
                        className="group flex h-full w-full max-w-14 appearance-none flex-col justify-end gap-[2px] border-0 bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                      >
                        {extra > 0 && <span className="block w-full rounded-t-[4px] bg-primary/30" style={{ height: `${(extra / top) * 100}%` }} />}
                        <span
                          className={cx("block w-full bg-primary transition-opacity group-hover:opacity-85", extra > 0 ? "rounded-none" : "rounded-t-[4px]", !selected && "opacity-70")}
                          style={{ height: `${Math.max((item.received / top) * 100, 1)}%` }}
                        />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent>{label}</TooltipContent>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        </div>
        <ol className="m-0 ml-14 flex list-none gap-3 p-0" aria-hidden="true">
          {history.map((item) => (
            <li key={item.month} className={cx("min-w-0 flex-1 text-center text-xs tabular-nums", item.month === month ? "font-extrabold text-foreground" : "font-semibold text-muted-foreground")}>
              {short[monthIndex(item.month)]}
            </li>
          ))}
        </ol>
        <dl className="m-0 mt-3 grid grid-cols-3 gap-3 border-t pt-4">
          <div className="grid gap-0.5">
            <dt className="text-xs font-bold text-muted-foreground">{text.average}</dt>
            <dd className="m-0 font-[family-name:var(--font-display)] text-lg font-extrabold tabular-nums">{formatRubles(Math.round(average / 100) * 100)}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-xs font-bold text-muted-foreground">{text.best}</dt>
            <dd className="m-0 font-[family-name:var(--font-display)] text-lg font-extrabold">{best ? `${short[monthIndex(best.month)]} · ${formatRubles(best.received)}` : "—"}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-xs font-bold text-muted-foreground">{text.lessons(monthNames[monthIndex(month)] ?? month)}</dt>
            <dd className="m-0 font-[family-name:var(--font-display)] text-lg font-extrabold tabular-nums">{history.find((item) => item.month === month)?.lessons ?? 0}</dd>
          </div>
        </dl>
      </div>
    </Card>
  );
}
