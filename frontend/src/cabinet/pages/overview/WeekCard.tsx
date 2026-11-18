import { Badge } from "@/shared/ui/kit/badge";
import { cabinet } from "../../content/cabinet.ru";
import { barHeightPercent, weekLoadPercent, weekTotal } from "../../model/week";
import type { WeekPlan } from "../../mocks/types";
import { CabinetLink } from "../../ui/CabinetLink";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { scheduleHref } from "../schedule/useScheduleUrl";

const text = cabinet.teacher.overview.week;

export function WeekCard({ week, today }: { week: WeekPlan; today: string }) {
  const total = weekTotal(week.days);

  return (
    <Card
      title={text.title}
      action={<Badge>{text.load(weekLoadPercent(week.days, week.capacity))}</Badge>}
    >
      <div className="flex flex-col gap-5">
        <p className="m-0 flex items-baseline gap-2">
          <strong className="font-[family-name:var(--font-display)] text-3xl leading-none font-extrabold tracking-tight tabular-nums">{total}</strong>
          <span className="text-sm font-semibold text-muted-foreground">{text.lessons(total)}</span>
        </p>
        <ol className="m-0 flex h-44 list-none items-stretch gap-2 p-0" aria-label={text.chartLabel}>
          {week.days.map((day) => (
            <li key={day.label} className="flex min-w-0 flex-1">
              {/* Столбец ведёт на этот день в расписании (OVERVIEW-8). */}
              <CabinetLink
                href={scheduleHref("day", day.date, today)}
                className="group flex min-w-0 flex-1 flex-col items-center gap-2 rounded-lg no-underline"
                aria-label={text.barLabel(day.label, day.lessons)}
              >
                <span className={cx("text-xs font-extrabold tabular-nums", day.today ? "text-primary" : "text-muted-foreground")} aria-hidden="true">
                  {day.lessons}
                </span>
                <div className="flex w-full flex-1 items-end justify-center rounded-lg bg-secondary p-1.5 transition-colors group-hover:bg-[var(--cab-blue-soft)]" aria-hidden="true">
                  <div
                    className={cx("w-full max-w-12 rounded-md transition-[height] duration-200 motion-reduce:transition-none", day.today ? "bg-primary" : "bg-primary/20")}
                    style={{ height: `${barHeightPercent(day.lessons, week.days)}%` }}
                  />
                </div>
                <span className={cx("rounded-md px-2 py-1 text-xs font-bold", day.today ? "bg-primary text-primary-foreground" : "text-muted-foreground")} aria-hidden="true">
                  {day.label}
                </span>
              </CabinetLink>
            </li>
          ))}
        </ol>
      </div>
    </Card>
  );
}
