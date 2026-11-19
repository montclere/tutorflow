import type { HomeworkPoint } from "../model/studentTasks";
import { examOf } from "./catalog";
import type { ExamId, SubjectId, TaskItem } from "./types";

/**
 * Прогресс ученика зависит от цели (STUDENT-1):
 * — готовится к экзамену: освоение по номерам экзамена, готовность и прогноз первичных баллов;
 * — просто занимается: освоение по темам программы, без экзаменационных баллов.
 * Источники: тренажёр, проверенные задания и тесты, стартовые данные.
 */

export type StudentGoal =
  | { kind: "exam"; exam: ExamId; daysLeft?: number }
  | { kind: "topics"; subject: SubjectId; title: string; topics: string[] };

export type Level = 0 | 1 | 2 | 3;
export type Tally = { correct: number; total: number };
export type Evidence = Record<string, Tally>;

export type Unit = { key: string; label: string; number?: number; points: number; correct: number; total: number; level: Level | null };

export type StudentProgress = {
  mode: StudentGoal["kind"];
  title: string;
  units: Unit[];
  mastered: number;
  /** Доля «готовности» — взвешенная по баллам точность; непройденное считается за ноль. */
  readiness: number;
  forecast: { score: number; max: number } | null;
  accuracy: number | null;
  weak: Unit[];
  trend: HomeworkPoint[];
};

/** Меньше трёх ответов — уровень не определён: рано судить. */
export const MIN_ANSWERS = 3;

export function levelOf(tally: Tally | undefined): Level | null {
  if (!tally || tally.total < MIN_ANSWERS) return null;
  const share = tally.correct / tally.total;
  if (share >= 0.85) return 3;
  if (share >= 0.7) return 2;
  if (share >= 0.5) return 1;
  return 0;
}

/** Баллы номера в первичной шкале: короткие ответы — 1, развёрнутые — по шкале экзамена. */
const examPoints: Record<string, Record<number, number>> = {
  "ege-math-profile": { 13: 2, 15: 2, 16: 2 },
};

export function unitKey(goal: StudentGoal, task: Pick<TaskItem, "exam" | "number" | "topic">): string | null {
  if (goal.kind === "exam") return task.exam === goal.exam && task.number !== undefined ? `n:${task.number}` : null;
  const topic = goal.topics.find((item) => task.topic.toLowerCase().includes(item.toLowerCase()) || item.toLowerCase().includes(task.topic.toLowerCase()));
  return topic ? `t:${topic}` : null;
}

export function mergeEvidence(...sources: Evidence[]): Evidence {
  const merged: Evidence = {};
  for (const source of sources) {
    for (const [key, tally] of Object.entries(source)) {
      const current = merged[key] ?? { correct: 0, total: 0 };
      merged[key] = { correct: current.correct + tally.correct, total: current.total + tally.total };
    }
  }
  return merged;
}

export function studentProgress(goal: StudentGoal, evidence: Evidence, trend: HomeworkPoint[] = []): StudentProgress {
  const units: Unit[] =
    goal.kind === "exam"
      ? (examOf(goal.exam)?.numbers ?? []).map((item) => {
          const tally = evidence[`n:${item.number}`];
          return { key: `n:${item.number}`, label: item.topic, number: item.number, points: examPoints[goal.exam]?.[item.number] ?? 1, correct: tally?.correct ?? 0, total: tally?.total ?? 0, level: levelOf(tally) };
        })
      : goal.topics.map((topic) => {
          const tally = evidence[`t:${topic}`];
          return { key: `t:${topic}`, label: topic, points: 1, correct: tally?.correct ?? 0, total: tally?.total ?? 0, level: levelOf(tally) };
        });
  const max = units.reduce((sum, unit) => sum + unit.points, 0);
  const earned = units.reduce((sum, unit) => sum + (unit.total > 0 ? (unit.correct / unit.total) * unit.points : 0), 0);
  const correct = units.reduce((sum, unit) => sum + unit.correct, 0);
  const total = units.reduce((sum, unit) => sum + unit.total, 0);
  return {
    mode: goal.kind,
    title: goal.kind === "exam" ? (examOf(goal.exam)?.label ?? goal.exam) : goal.title,
    units,
    mastered: units.filter((unit) => unit.level === 3).length,
    readiness: max > 0 ? Math.round((earned / max) * 100) : 0,
    forecast: goal.kind === "exam" ? { score: Math.round(earned), max } : null,
    accuracy: total > 0 ? Math.round((correct / total) * 100) : null,
    weak: units
      .filter((unit) => unit.level !== null && unit.level <= 1)
      .sort((a, b) => a.correct / a.total - b.correct / b.total)
      .slice(0, 3),
    trend,
  };
}
