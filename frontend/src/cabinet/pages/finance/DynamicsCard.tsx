import { TrendingUp } from "lucide-react";
import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ReferenceDot, XAxis, YAxis } from "recharts";
import { cabinet } from "../../content/cabinet.ru";
import type { MonthStat } from "../../mocks/types";
import { formatMonthTitle } from "../../model/dates";
import { chartSeries, growthPercent, monthIndex, seriesDomain, shiftMonth, type DynamicsMetric } from "../../model/finance";
import { Card } from "../../ui/Card";
import { usePrefersReducedMotion } from "../../ui/useMotion";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/shared/ui/kit/chart";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.finance.dynamics;
const monthShort = cabinet.teacher.finance.monthShort;
const received = cabinet.teacher.finance.received;

type Props = { history: MonthStat[]; month: string; onPick: (month: string) => void };

export function DynamicsCard({ history, month, onPick }: Props) {
  const [metric, setMetric] = useState<DynamicsMetric>("received");
  const reduced = usePrefersReducedMotion();
  const points = chartSeries(history, metric);
  const label = text.metrics.find((item) => item.id === metric)?.label ?? "";
  const selected = points.find((point) => point.month === month);
  const previous = points.find((point) => point.month === shiftMonth(month, -1));
  const growth = selected && previous ? growthPercent(selected.value, previous.value) : null;
  const format = text.value[metric];
  const config = { value: { label, color: "var(--color-blue)" } } satisfies ChartConfig;
  const first = points[0];
  const last = points[points.length - 1];

  return (
    <Card title={text.title}>
      <ToggleGroup
        type="single"
        value={metric}
        spacing={1}
        aria-label={text.metricLabel}
        className="mb-4 gap-1 rounded-lg border bg-card p-1 max-[520px]:w-full"
        onValueChange={(value) => value && setMetric(value as DynamicsMetric)}
      >
        {text.metrics.map((item) => (
          <ToggleGroupItem key={item.id} value={item.id} className="data-[state=on]:bg-accent data-[state=on]:text-accent-foreground max-[520px]:flex-1">
            {item.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      <ChartContainer config={config} className="aspect-auto h-64 w-full cursor-pointer" role="img" aria-label={text.chartLabel(label)}>
        <AreaChart
          data={points}
          margin={{ left: 8, right: 8, top: 14 }}
          onClick={(state) => {
            const index = Number(state?.activeTooltipIndex);
            const point = Number.isInteger(index) ? points[index] : undefined;
            if (point) onPick(point.month);
          }}
        >
          <defs>
            <linearGradient id="dynamicsFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--color-value)" stopOpacity={0.55} />
              <stop offset="95%" stopColor="var(--color-value)" stopOpacity={0.03} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} />
          <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={10} interval={0} padding={{ left: 16, right: 16 }} tickFormatter={(value: string) => monthShort[monthIndex(value)] ?? ""} />
          <YAxis hide domain={seriesDomain(points)} />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                labelFormatter={(value) => formatMonthTitle(`${String(value)}-01`)}
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-6">
                    <span className="text-muted-foreground">{name}</span>
                    <b className="font-extrabold tabular-nums">{format(Number(value))}</b>
                  </div>
                )}
              />
            }
          />
          <Area
            dataKey="value"
            name={label}
            type="monotone"
            stroke="var(--color-value)"
            strokeWidth={2.5}
            fill="url(#dynamicsFill)"
            dot={{ r: 3, fill: "var(--color-value)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
            isAnimationActive={!reduced}
            animationDuration={900}
          />
          {selected && (
            <ReferenceDot x={selected.month} y={selected.value} r={7} fill="var(--color-lime)" stroke="var(--color-blue)" strokeWidth={2.5} ifOverflow="visible" />
          )}
        </AreaChart>
      </ChartContainer>
      <p className="m-0 mt-5 flex flex-wrap items-center justify-between gap-x-4 gap-y-1 text-sm font-semibold text-muted-foreground">
        {growth !== null ? (
          <span className="inline-flex items-center gap-1.5 font-bold text-foreground tabular-nums">
            <TrendingUp size={16} className="text-primary" aria-hidden="true" />
            {received.growth(growth, monthIndex(shiftMonth(month, -1)))}
          </span>
        ) : (
          <span>{text.open}</span>
        )}
        {first && last && <span>{text.range(monthShort[monthIndex(first.month)] ?? "", monthShort[monthIndex(last.month)] ?? "")}</span>}
      </p>
    </Card>
  );
}
