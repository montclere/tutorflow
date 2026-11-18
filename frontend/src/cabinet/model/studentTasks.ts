import type { AssignedTask, TaskScore } from "../mocks/types";

export function taskPercent(score: TaskScore): number {
  return score.total > 0 ? Math.round((score.correct / score.total) * 100) : 0;
}

export type TaskStats = { checked: number; percent: number | null; mistakes: number; topTopic: string | null };

export function taskStats(tasks: AssignedTask[]): TaskStats {
  const checked = tasks.filter((task) => task.score !== null);
  const correct = checked.reduce((sum, task) => sum + (task.score?.correct ?? 0), 0);
  const total = checked.reduce((sum, task) => sum + (task.score?.total ?? 0), 0);
  const counts = new Map<string, number>();
  for (const mistake of checked.flatMap((task) => task.mistakes)) {
    counts.set(mistake.topic, (counts.get(mistake.topic) ?? 0) + 1);
  }
  let topTopic: string | null = null;
  let best = 0;
  for (const [topic, count] of counts) {
    if (count > best) {
      topTopic = topic;
      best = count;
    }
  }
  return {
    checked: checked.length,
    percent: total > 0 ? Math.round((correct / total) * 100) : null,
    mistakes: [...counts.values()].reduce((sum, count) => sum + count, 0),
    topTopic,
  };
}

export type HomeworkPoint = { title: string; date: string; percent: number; correct: number; total: number };

/** Проверенные домашки по дате сдачи — для графика результатов. */
export function homeworkTimeline(tasks: AssignedTask[]): HomeworkPoint[] {
  return tasks
    .flatMap((task) => (task.score ? [{ title: task.title, date: task.submittedAt ?? task.assignedAt, percent: taskPercent(task.score), correct: task.score.correct, total: task.score.total }] : []))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type TopicCount = { topic: string; count: number };

/** Темы ошибок по убыванию частоты. */
export function weakTopics(tasks: AssignedTask[], limit = 5): TopicCount[] {
  const counts = new Map<string, number>();
  for (const mistake of tasks.flatMap((task) => task.mistakes)) counts.set(mistake.topic, (counts.get(mistake.topic) ?? 0) + 1);
  return [...counts.entries()]
    .map(([topic, count]) => ({ topic, count }))
    .sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic, "ru"))
    .slice(0, limit);
}

export type HomeworkSummary = { todo: number; overdue: number; wait: number; done: number; onTime: number | null; trend: number | null };

/**
 * Сводка по домашкам: сколько ждут выполнения (из них просрочено), на проверке, проверено;
 * доля сданных в срок (среди тех, у кого был срок) и изменение результата: последние три против трёх до них.
 */
export function homeworkSummary(tasks: AssignedTask[], today: string): HomeworkSummary {
  const withDue = tasks.filter((task) => task.due && task.submittedAt);
  const onTime = withDue.filter((task) => (task.submittedAt ?? "") <= (task.due ?? ""));
  const points = homeworkTimeline(tasks).map((point) => point.percent);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const recent = points.slice(-3);
  const before = points.slice(-6, -3);
  return {
    todo: tasks.filter((task) => task.status === "todo").length,
    overdue: tasks.filter((task) => task.status === "todo" && task.due !== undefined && task.due < today).length,
    wait: tasks.filter((task) => task.status === "wait").length,
    done: tasks.filter((task) => task.status === "done").length,
    onTime: withDue.length > 0 ? Math.round((onTime.length / withDue.length) * 100) : null,
    trend: recent.length > 0 && before.length > 0 ? Math.round(average(recent) - average(before)) : null,
  };
}
