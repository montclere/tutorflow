import type { Unit } from "../tasks/progress";
import { startOfWeek } from "./dates";
import type { HomeworkPoint } from "./studentTasks";

export type ProgressFilter = "all" | "weak" | "medium" | "mastered";
export type WeeklyProgress = { week: string; correct: number; total: number; percent: number; works: number };

/** STUDENT-PROGRESS-UI-1: только отображение, исходные уровни не пересчитываются. */
export function filterProgressUnits(units: Unit[], filter: ProgressFilter): Unit[] {
  const levels = { weak: 0, medium: 1, mastered: 3 };
  return filter === "all" ? units : units.filter(unit => unit.level === levels[filter]);
}

/** STUDENT-PROGRESS-UI-2: реальные недели, взвешенные по количеству ответов. */
export function weeklyProgress(points: HomeworkPoint[]): WeeklyProgress[] {
  const weeks = new Map<string, WeeklyProgress>();
  for (const point of points) {
    if (point.total <= 0) continue;
    const week = startOfWeek(point.date);
    const item = weeks.get(week) ?? { week, correct: 0, total: 0, percent: 0, works: 0 };
    item.correct += point.correct;
    item.total += point.total;
    item.works += 1;
    item.percent = Math.round(item.correct / item.total * 100);
    weeks.set(week, item);
  }
  return [...weeks.values()].sort((a, b) => a.week.localeCompare(b.week)).slice(-6);
}

export function weakProgressPreview(weak: Unit[], trainable: ReadonlySet<number>, exam: boolean): { units: Unit[]; number: number | null } {
  const units = weak.slice(0, 2);
  const number = exam ? units.find(unit => unit.number !== undefined && trainable.has(unit.number))?.number ?? null : null;
  return { units, number };
}
