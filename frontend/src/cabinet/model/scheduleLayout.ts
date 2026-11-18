import type { ScheduleLesson, WorkHours } from "../mocks/types";
import { compareLessons, lessonEnd } from "./lessons";
import { formatMinutes, toMinutes } from "./time";

export type BlockPosition = { topHours: number; heightHours: number };
export type TimeWindow = { start: string; end: string };
export type LessonSlot = { lesson: ScheduleLesson; column: number; columns: number };

export function blockPosition(start: string, durationMin: number, gridStart: string): BlockPosition {
  return {
    topHours: (toMinutes(start) - toMinutes(gridStart)) / 60,
    heightHours: durationMin / 60,
  };
}

export function gridHours(work: WorkHours): string[] {
  const first = Math.floor(toMinutes(work.start) / 60);
  const last = Math.ceil(toMinutes(work.end) / 60);
  return Array.from({ length: last - first }, (_, index) => formatMinutes((first + index) * 60));
}

const DAY_MINUTES = 24 * 60;

/** Сетка дня расширяется под уроки окна, чтобы ранний или поздний урок не выпал из вида. */
export function workHoursFor(base: WorkHours, lessons: ScheduleLesson[]): WorkHours {
  let start = toMinutes(base.start);
  let end = toMinutes(base.end);
  for (const lesson of lessons) {
    const from = toMinutes(lesson.start);
    start = Math.min(start, Math.floor(from / 60) * 60);
    end = Math.max(end, Math.min(DAY_MINUTES, Math.ceil((from + lesson.durationMin) / 60) * 60));
  }
  return { ...base, start: formatMinutes(start), end: formatMinutes(end) };
}

export function nowOffsetHours(now: string, work: WorkHours): number | null {
  const minutes = toMinutes(now);
  if (minutes < toMinutes(work.start) || minutes > toMinutes(work.end)) return null;
  return (minutes - toMinutes(work.start)) / 60;
}

export function assignColumns(lessons: ScheduleLesson[]): LessonSlot[] {
  const sorted = [...lessons].sort(compareLessons);
  const result: LessonSlot[] = [];
  let cluster: { lesson: ScheduleLesson; column: number }[] = [];
  let clusterEnd = -1;
  let columnEnds: number[] = [];

  const flush = () => {
    for (const item of cluster) result.push({ ...item, columns: columnEnds.length });
    cluster = [];
    columnEnds = [];
  };

  for (const lesson of sorted) {
    const start = toMinutes(lesson.start);
    if (cluster.length > 0 && start >= clusterEnd) flush();
    let column = columnEnds.findIndex((end) => end <= start);
    if (column === -1) column = columnEnds.length;
    columnEnds[column] = toMinutes(lessonEnd(lesson));
    clusterEnd = Math.max(clusterEnd, columnEnds[column] ?? 0);
    cluster.push({ lesson, column });
  }
  flush();
  return result;
}

export function freeWindows(lessons: ScheduleLesson[], work: WorkHours): TimeWindow[] {
  const windows: TimeWindow[] = [];
  let cursor = toMinutes(work.start);
  const close = (until: number) => {
    if (until - cursor >= work.minFreeWindowMin) windows.push({ start: formatMinutes(cursor), end: formatMinutes(until) });
  };

  for (const lesson of [...lessons].sort(compareLessons)) {
    close(Math.min(toMinutes(lesson.start), toMinutes(work.end)));
    cursor = Math.max(cursor, toMinutes(lessonEnd(lesson)));
  }
  close(toMinutes(work.end));
  return windows;
}

export function clipWindowsFrom(windows: TimeWindow[], from: string, minMinutes: number): TimeWindow[] {
  const clipped: TimeWindow[] = [];
  for (const window of windows) {
    const start = Math.max(toMinutes(window.start), toMinutes(from));
    if (toMinutes(window.end) - start >= minMinutes) clipped.push({ start: formatMinutes(start), end: window.end });
  }
  return clipped;
}
