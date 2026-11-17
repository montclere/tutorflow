import { Share2 } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { barHeightPercent, freeWindowsText, weekLoadPercent, weekTotal } from "../../model/week";
import type { WeekPlan } from "../../mocks/types";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Separator } from "@/shared/ui/kit/separator";

const text = cabinet.teacher.overview.week;

export function WeekCard({ week }: { week: WeekPlan }) {
  const { notify } = useNotifier();
  const total = weekTotal(week.days);

  const share = async () => {
    try {
      await navigator.clipboard.writeText(freeWindowsText(text.shareIntro, week.freeWindows));
      notify(text.copied);
    } catch {
      notify(text.copyFailed);
    }
  };

  return (
    <Card
      title={text.title}
      action={<span className="text-xs font-bold text-muted-foreground tabular-nums">{text.summary(total, weekLoadPercent(week.days, week.capacity))}</span>}
    >
      <div className="flex flex-col gap-4">
      <ol className="m-0 flex h-36 list-none items-stretch gap-2 p-0" aria-label={text.chartLabel}>
        {week.days.map((day) => (
          <li key={day.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5" aria-label={text.barLabel(day.label, day.lessons)}>
            <span className={cx("text-xs font-extrabold tabular-nums", day.today ? "text-primary" : "text-muted-foreground")} aria-hidden="true">
              {day.lessons}
            </span>
            <div className="flex w-full flex-1 items-end" aria-hidden="true">
              <div
                className={cx("min-h-1 w-full rounded-md transition-[height] duration-200 motion-reduce:transition-none", day.today ? "bg-primary" : "bg-accent")}
                style={{ height: `${barHeightPercent(day.lessons, week.days)}%` }}
              />
            </div>
            <span className={cx("text-xs font-bold", day.today ? "text-primary" : "text-muted-foreground")} aria-hidden="true">
              {day.label}
            </span>
          </li>
        ))}
      </ol>
      <Separator />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 min-w-0 flex-1 text-sm font-semibold text-muted-foreground">{text.freeWindows(week.freeWindows)}</p>
        <Button size="sm" icon={Share2} onClick={share}>
          {text.share}
        </Button>
      </div>
      </div>
    </Card>
  );
}
