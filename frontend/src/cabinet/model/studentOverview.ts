import type { AssignedTask, RecentLesson } from "../mocks/types";
import { addDays } from "./dates";

export type OverviewPeriod = 14 | 31;

/** Только выбор истории; формулы показателей остаются прежними. */
export function overviewHistory(lessons: RecentLesson[], tasks: AssignedTask[], today: string, days: OverviewPeriod) {
  const from = addDays(today, 1 - days);
  const within = (date: string) => date >= from && date <= today;
  return {
    lessons: lessons.filter((lesson) => within(lesson.date)),
    tasks: tasks.filter((task) => within(task.submittedAt ?? task.assignedAt)),
  };
}
