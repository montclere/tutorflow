import { addDays, addMonths, formatLongDay, formatMonthTitle, formatRange, weekDates } from "./dates";

export type ScheduleView = "day" | "week" | "month" | "list";
export type DateRange = { from: string; to: string };

export const LIST_DAYS = 14;

export function viewRange(view: ScheduleView, date: string, withWeekend: boolean): DateRange {
  switch (view) {
    case "day":
      return { from: date, to: date };
    case "week": {
      const days = weekDates(date, withWeekend);
      return { from: days[0] ?? date, to: days.at(-1) ?? date };
    }
    case "month": {
      const from = addMonths(date, 0);
      return { from, to: addDays(addMonths(date, 1), -1) };
    }
    case "list":
      return { from: date, to: addDays(date, LIST_DAYS - 1) };
  }
}

export function stepDate(view: ScheduleView, date: string, direction: 1 | -1): string {
  switch (view) {
    case "day":
      return addDays(date, direction);
    case "week":
      return addDays(date, direction * 7);
    case "month":
      return addMonths(date, direction);
    case "list":
      return addDays(date, direction * LIST_DAYS);
  }
}

export function periodTitle(view: ScheduleView, date: string, withWeekend: boolean): string {
  const range = viewRange(view, date, withWeekend);
  if (view === "day") return formatLongDay(date);
  if (view === "month") return formatMonthTitle(date);
  return formatRange(range.from, range.to);
}

export function parseView(value: string | null, fallback: ScheduleView): ScheduleView {
  return value === "day" || value === "week" || value === "month" || value === "list" ? value : fallback;
}

export function parseDateParam(value: string | null, fallback: string): string {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback;
}
