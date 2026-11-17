import { Clock, TriangleAlert, Wallet, type LucideIcon } from "lucide-react";
import { Area, AreaChart, ReferenceDot, XAxis, YAxis } from "recharts";
import { cabinet } from "../../content/cabinet.ru";
import type { FinanceOverview } from "../../mocks/types";
import { chartSeries, monthIndex, seriesDomain, shiftMonth } from "../../model/finance";
import { formatRubles } from "../../model/format";
import { cx } from "../../ui/cx";
import { useCountUp, usePrefersReducedMotion } from "../../ui/useMotion";
import { Badge } from "@/shared/ui/kit/badge";
import { Card } from "@/shared/ui/kit/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/shared/ui/kit/chart";
import { formatMonthTitle } from "../../model/dates";
import styles from "./finance.module.css";

const received = cabinet.teacher.finance.received;
const tiles = cabinet.teacher.finance.tiles;
const monthNames = cabinet.teacher.finance.monthNames;

const ROUND = 100;

function rubles(kopecks: number): string {
  return formatRubles(Math.round(kopecks / ROUND) * ROUND);
}

type TileProps = { icon: LucideIcon; label: string; amount: number; note: string; alert?: boolean; delay: number };

function Tile({ icon: Icon, label, amount, note, alert, delay }: TileProps) {
  const shown = useCountUp(amount);
  return (
    <Card className={cx("flex-row items-center gap-4 px-5 py-4", styles.rise, alert && "border-destructive")} style={{ "--delay": `${delay}ms` } as React.CSSProperties}>
      <span className={cx("grid size-11 flex-none place-items-center rounded-xl", alert ? "bg-[var(--cab-bad-soft)] text-destructive" : "bg-accent text-primary")}>
        <Icon size={22} aria-hidden="true" />
      </span>
      <div className="grid min-w-0 gap-0.5">
        <span className="text-sm font-bold text-muted-foreground">{label}</span>
        <b className={cx("font-[family-name:var(--font-display)] text-2xl leading-tight font-black tracking-tight tabular-nums", alert && "text-destructive")}>{rubles(shown)}</b>
        <span className="text-sm font-semibold text-muted-foreground tabular-nums">{note}</span>
      </div>
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

function Sparkline({ data }: { data: FinanceOverview }) {
  const reduced = usePrefersReducedMotion();
  const points = chartSeries(data.history, "received");
  const selected = points.find((point) => point.month === data.month);
  const config = { value: { label: received.chartLabel, color: "var(--color-paper)" } } satisfies ChartConfig;

  return (
    <ChartContainer config={config} className="aspect-auto h-32 w-full" role="img" aria-label={received.chartLabel}>
      <AreaChart data={points} margin={{ left: 0, right: 10, top: 12, bottom: 0 }}>
        <defs>
          <linearGradient id="heroFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-value)" stopOpacity={0.4} />
            <stop offset="100%" stopColor="var(--color-value)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="month" hide />
        <YAxis hide domain={seriesDomain(points)} />
        <ChartTooltip
          cursor={false}
          content={
            <ChartTooltipContent
              hideIndicator
              labelFormatter={(value) => formatMonthTitle(`${String(value)}-01`)}
              formatter={(value) => <b className="font-extrabold tabular-nums">{rubles(Number(value))}</b>}
            />
          }
        />
        <Area
          dataKey="value"
          name={received.chartLabel}
          type="monotone"
          stroke="var(--color-value)"
          strokeWidth={2.5}
          fill="url(#heroFill)"
          dot={false}
          activeDot={{ r: 5, fill: "var(--color-paper)", stroke: "var(--color-blue)", strokeWidth: 2 }}
          isAnimationActive={!reduced}
          animationDuration={1100}
        />
        {selected && <ReferenceDot x={selected.month} y={selected.value} r={6} fill="var(--color-lime)" stroke="var(--color-paper)" strokeWidth={2.5} ifOverflow="visible" />}
      </AreaChart>
    </ChartContainer>
  );
}

export function MoneyTiles({ data }: { data: FinanceOverview }) {
  const stat = data.stat;
  const total = useCountUp(stat?.received ?? 0, 1100);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <Card className={cx("justify-between gap-4 overflow-hidden border-transparent bg-primary pt-6 pb-0 text-primary-foreground", styles.rise)}>
        <div className="grid gap-4 px-6">
          <span className="text-base font-bold text-white/80">{received.title(monthNames[monthIndex(data.month)] ?? "")}</span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
            <b className="font-[family-name:var(--font-display)] text-5xl leading-none font-black tracking-tight tabular-nums max-[520px]:text-4xl">{rubles(total)}</b>
            {data.receivedGrowth !== null && <Growth percent={data.receivedGrowth} month={data.month} />}
          </div>
          {stat && <span className="text-sm font-semibold text-white/75 tabular-nums">{received.summary(stat.payments, stat.lessons)}</span>}
        </div>
        <Sparkline data={data} />
      </Card>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
        <Tile icon={Clock} label={tiles.expected.label} amount={data.expected.amount} note={tiles.expected.note} delay={80} />
        <Tile icon={TriangleAlert} label={tiles.debt.label} amount={data.debt.amount} note={tiles.debt.note(data.debt.count)} alert={data.debt.amount > 0} delay={160} />
        <Tile icon={Wallet} label={tiles.prepaid.label} amount={data.prepaid.amount} note={tiles.prepaid.note(data.prepaid.lessons)} delay={240} />
      </div>
    </div>
  );
}
