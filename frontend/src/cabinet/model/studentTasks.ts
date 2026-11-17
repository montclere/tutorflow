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
