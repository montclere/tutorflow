import type { WeekDay } from "../mocks/types";

export function weekTotal(days: WeekDay[]): number {
  return days.reduce((sum, day) => sum + day.lessons, 0);
}

export function weekLoadPercent(days: WeekDay[], capacity: number): number {
  return capacity > 0 ? Math.round((weekTotal(days) / capacity) * 100) : 0;
}

export function barHeightPercent(lessons: number, days: WeekDay[]): number {
  const max = Math.max(...days.map((day) => day.lessons), 0);
  return max > 0 ? Math.round((lessons / max) * 100) : 0;
}

export function freeWindowsText(intro: string, windows: string[]): string {
  return [intro, ...windows].join("\n");
}
