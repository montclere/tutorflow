import { cabinet } from "../../../content/cabinet.ru";
import { formatShortDate } from "../../../model/dates";
import type { HomeworkPoint } from "../../../model/studentTasks";
import { cx } from "../../../ui/cx";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/ui/kit/tooltip";

const text = cabinet.teacher.students.profile.tasks;
const GRID = [100, 50];

/**
 * Результаты домашек столбиками: один ряд — один цвет, значение — в подсказке и подписи для чтения с экрана,
 * таблица с цифрами — список заданий ниже. Нулевая линия — основание столбиков.
 */
export function ResultBars({ points, compact }: { points: HomeworkPoint[]; compact?: boolean }) {
  return (
    <div className="grid gap-2">
      <div className={cx("relative", compact ? "h-20" : "h-44")}>
        {!compact &&
          GRID.map((line) => (
            <span key={line} className="pointer-events-none absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${line}%` }} aria-hidden="true">
              <span className="w-9 flex-none text-right text-xs font-semibold text-muted-foreground tabular-nums">{line}%</span>
              <span className="h-px flex-1 bg-border/70" />
            </span>
          ))}
        <ol className={cx("absolute inset-y-0 right-0 m-0 flex list-none items-end gap-[2px] p-0", compact ? "left-0" : "left-11")} aria-label={text.chartLabel}>
          {points.map((point, index) => {
            const label = text.bar(point.title, formatShortDate(point.date), point.percent, point.correct, point.total);
            return (
              <li key={`${point.title}-${index}`} className="flex h-full min-w-0 flex-1 justify-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    {/* Цель наведения — вся колонка, а не только столбик. */}
                    <button type="button" aria-label={label} className={cx("group flex h-full w-full appearance-none items-end border-0 bg-transparent p-0 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40", compact ? "max-w-7" : "max-w-12")}>
                      <span
                        className="block w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                        style={{ height: `${Math.max(point.percent, 2)}%` }}
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
      {!compact && (
        <ol className="m-0 ml-11 flex list-none gap-[2px] p-0" aria-hidden="true">
          {points.map((point, index) => (
            <li key={`${point.title}-${index}`} className="min-w-0 flex-1 text-center text-xs font-semibold text-muted-foreground tabular-nums">
              {formatShortDate(point.date)}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
