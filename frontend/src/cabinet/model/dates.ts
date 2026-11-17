const MS_PER_DAY = 86_400_000;

export function parseDate(iso: string): Date {
  const [year = 1970, month = 1, day = 1] = iso.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function toDateString(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function addDays(iso: string, days: number): string {
  const date = parseDate(iso);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

export function daysBetween(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / MS_PER_DAY);
}

export function weekdayIndex(iso: string): number {
  return (parseDate(iso).getDay() + 6) % 7;
}

export function startOfWeek(iso: string): string {
  return addDays(iso, -weekdayIndex(iso));
}

export function weekDates(anchor: string): string[] {
  const start = startOfWeek(anchor);
  return Array.from({ length: 7 }, (_, index) => addDays(start, index));
}

export function monthGrid(anchor: string): string[][] {
  const first = parseDate(anchor);
  first.setDate(1);
  const firstIso = toDateString(first);
  const last = new Date(first.getFullYear(), first.getMonth() + 1, 0);
  const start = startOfWeek(firstIso);
  const weeks = Math.ceil((daysBetween(start, toDateString(last)) + 1) / 7);
  return Array.from({ length: weeks }, (_, week) => Array.from({ length: 7 }, (_, day) => addDays(start, week * 7 + day)));
}

export function isSameMonth(a: string, b: string): boolean {
  return a.slice(0, 7) === b.slice(0, 7);
}

export function addMonths(iso: string, months: number): string {
  const date = parseDate(iso);
  date.setDate(1);
  date.setMonth(date.getMonth() + months);
  return toDateString(date);
}

const dayMonth = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long" });
const dayMonthWeekday = new Intl.DateTimeFormat("ru-RU", { weekday: "long", day: "numeric", month: "long" });
const monthYear = new Intl.DateTimeFormat("ru-RU", { month: "long", year: "numeric" });

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function formatLongDay(iso: string): string {
  return capitalize(dayMonthWeekday.format(parseDate(iso)));
}

export function formatMonthTitle(iso: string): string {
  return capitalize(monthYear.format(parseDate(iso))).replace(/\s*г\.$/, "");
}

export function formatRange(from: string, to: string): string {
  const start = parseDate(from);
  const end = parseDate(to);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} — ${dayMonth.format(end)}`;
  }
  return `${dayMonth.format(start)} — ${dayMonth.format(end)}`;
}
