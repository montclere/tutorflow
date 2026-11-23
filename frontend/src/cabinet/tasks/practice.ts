import { useSyncExternalStore } from "react";
import { canGenerate, makeAnalogs, seededRandom } from "./analogs";
import { bankTasks } from "./bank";
import { isAutoChecked } from "./check";
import type { ExamId, TaskItem } from "./types";

/**
 * Тренажёр ученика (STUDENT-5): бесконечные задачи с мгновенной проверкой — из банка и аналогов.
 * Каждый ответ идёт в журнал и двигает прогресс; ошибки собираются в «Мои ошибки».
 */

export type PracticeMode = "weak" | "number" | "mistakes";
export type PracticeEntry = { taskId: string; exam?: ExamId; number?: number; topic: string; correct: boolean; at: number };

/** Мини-мониторинг (STUDENT-5): журнал ответов, очередь ошибок и сколько задач решено за 7 дней. Без опыта и серий. */
type PracticeState = { log: PracticeEntry[]; mistakes: TaskItem[]; weekSolved: number };

export const SESSION_LENGTH = 10;

let state: PracticeState = { log: [], mistakes: [], weekSolved: 96 };
const listeners = new Set<() => void>();

function set(next: PracticeState) {
  state = next;
  for (const listener of listeners) listener();
}

export function getPractice(): PracticeState {
  return state;
}

export function subscribePractice(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function usePractice(): PracticeState {
  return useSyncExternalStore(subscribePractice, getPractice);
}

/** Ответ в тренажёре: журнал, счётчик за неделю и очередь ошибок. */
export function recordPractice(task: TaskItem, correct: boolean, at = Date.now()): void {
  const mistakes = correct ? state.mistakes.filter((item) => item.id !== task.id) : [task, ...state.mistakes.filter((item) => item.id !== task.id)];
  set({
    ...state,
    log: [...state.log, { taskId: task.id, exam: task.exam, number: task.number, topic: task.topic, correct, at }],
    mistakes,
    weekSolved: state.weekSolved + 1,
  });
}


/** Номера, по которым в тренажёре есть задачи с автопроверкой. */
export function practiceNumbers(exam: ExamId): Set<number> {
  return new Set(bankTasks.filter((task) => task.exam === exam && task.number !== undefined && isAutoChecked(task)).map((task) => task.number as number));
}

export type PickOptions = { exam: ExamId; number?: number; weak: number[]; seed: number; recent: string[] };

/**
 * Следующая задача: «Слабые места» — по слабым номерам по кругу, «По номеру» — выбранный номер,
 * «Мои ошибки» — задачи, где ошибся. Сначала свежие задачи банка, потом аналоги с новыми числами.
 */
export function pickTask(mode: PracticeMode, options: PickOptions): TaskItem | null {
  if (mode === "mistakes") return state.mistakes.find((task) => !options.recent.includes(task.id)) ?? state.mistakes[0] ?? null;
  const available = practiceNumbers(options.exam);
  const pool = mode === "weak" ? options.weak.filter((number) => available.has(number)) : [];
  const number = mode === "number" ? options.number : pool.length > 0 ? pool[options.seed % pool.length] : [...available][options.seed % Math.max(available.size, 1)];
  if (number === undefined) return null;
  const candidates = bankTasks.filter((task) => task.exam === options.exam && task.number === number && isAutoChecked(task));
  const random = seededRandom(options.seed);
  const fresh = candidates.filter((task) => !options.recent.includes(task.id));
  if (fresh.length > 0) return fresh[Math.floor(random() * fresh.length)] ?? null;
  const base = candidates.find(canGenerate);
  return base ? (makeAnalogs(base, 1, options.seed)[0] ?? null) : (candidates[0] ?? null);
}

/** Журнал тренажёра — в данные прогресса: по номеру экзамена. */
export function practiceEvidence(exam: ExamId): Record<string, { correct: number; total: number }> {
  const evidence: Record<string, { correct: number; total: number }> = {};
  for (const entry of state.log) {
    if (entry.exam !== exam || entry.number === undefined) continue;
    const key = `n:${entry.number}`;
    const current = evidence[key] ?? { correct: 0, total: 0 };
    evidence[key] = { correct: current.correct + Number(entry.correct), total: current.total + 1 };
  }
  return evidence;
}
