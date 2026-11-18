import type { ScheduleLesson, WorkHours } from "../mocks/types";
import { lessonsOn } from "./lessons";
import { clipWindowsFrom, freeWindows, type TimeWindow } from "./scheduleLayout";

export type DatedWindow = { date: string; window: TimeWindow };

export function upcomingFreeWindows(lessons: ScheduleLesson[], dates: string[], work: WorkHours, today: string, now: string): DatedWindow[] {
  const result: DatedWindow[] = [];
  for (const date of dates) {
    if (date < today) continue;
    const windows = freeWindows(lessonsOn(lessons, date), work);
    const visible = date === today ? clipWindowsFrom(windows, now, work.minFreeWindowMin) : windows;
    for (const window of visible) result.push({ date, window });
  }
  return result;
}
