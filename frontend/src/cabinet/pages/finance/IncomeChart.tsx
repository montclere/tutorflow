import { ChartNoAxesColumnIncreasing, Coins, GraduationCap } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { MonthStat } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { monthIndex } from "../../model/finance";
import { Card } from "../../ui/Card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";
import styles from "./finance.module.css";

const text = cabinet.teacher.finance.income;
const short = cabinet.teacher.finance.monthShort;
const monthNames = cabinet.teacher.finance.monthNames;
const RUBLES_IN_THOUSAND = 100_000;

function niceStep(max: number): number {
  const raw = max / 3;
  const power = 10 ** Math.floor(Math.log10(raw || 1));
  return ([1, 2, 2.5, 5, 10].find((step) => step * power >= raw) ?? 10) * power;
}

type Props = { history: MonthStat[]; month: string; currentMonth: string; expected: number; onPick: (month: string) => void };

export function IncomeChart({ history, month, currentMonth, expected, onPick }: Props) {
  const totals = history.map((item) => item.received + (item.month === currentMonth ? expected : 0));
  const step = niceStep(Math.max(...totals, 1));
  const top = step * Math.max(1, Math.ceil(Math.max(...totals) / step));
  const average = history.reduce((sum, item) => sum + item.received, 0) / Math.max(history.length, 1);
  const picked = history.find((item) => item.month === month);
  const grid = Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step);

  return <Card title={text.title} className={`${styles.card} ${styles.incomeCard}`}>
    <div className={styles.chart}>
      <div className={styles.plot}>
        {grid.map((value) => <span key={value} className={styles.gridLine} style={{ bottom: `${(value / top) * 100}%` }} aria-hidden="true"><span>{text.thousands(Math.round(value / RUBLES_IN_THOUSAND))}</span><i /></span>)}
        <ol className={styles.bars} aria-label={text.chartLabel}>
          {history.map((item) => {
            const extra = item.month === currentMonth ? expected : 0;
            const selected = item.month === month;
            const name = monthNames[monthIndex(item.month)] ?? item.month;
            const label = text.bar(name, formatRubles(item.received), extra > 0 ? formatRubles(extra) : null);
            return <li key={item.month}>
              {selected && <span className={styles.barValue} style={{ bottom: `calc(${((item.received + extra) / top) * 100}% + 6px)` }}>{formatRubles(item.received)}</span>}
              <Tooltip><TooltipTrigger asChild>
                <button type="button" aria-label={label} aria-pressed={selected} onClick={() => onPick(item.month)} className={styles.barButton}>
                  {extra > 0 && <span className={styles.barExpected} style={{ height: `${(extra / top) * 100}%` }} />}
                  <span className={`${styles.barReceived} ${selected ? styles.barSelected : ""}`} style={{ height: `${Math.max((item.received / top) * 100, 1)}%` }} />
                </button>
              </TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>
            </li>;
          })}
        </ol>
      </div>
      <ol className={styles.months} aria-hidden="true">{history.map((item) => <li key={item.month}><span className={item.month === month ? styles.selectedMonth : undefined}>{short[monthIndex(item.month)]}</span></li>)}</ol>
      <dl className={styles.chartMetrics}>
        <div><ChartNoAxesColumnIncreasing aria-hidden="true" /><div><dt>{text.average}</dt><dd>{formatRubles(Math.round(average / 100) * 100)}</dd></div></div>
        <div><GraduationCap aria-hidden="true" /><div><dt>{text.lessons(monthNames[monthIndex(month)] ?? month)}</dt><dd>{picked?.lessons ?? 0}</dd></div></div>
        <div><Coins aria-hidden="true" /><div><dt>{text.check}</dt><dd>{picked && picked.payments > 0 ? formatRubles(Math.round(picked.received / picked.payments / 100) * 100) : "—"}</dd></div></div>
      </dl>
    </div>
  </Card>;
}
