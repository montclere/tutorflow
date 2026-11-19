import { useSyncExternalStore } from "react";
import type { AssignedTask, TaskMistake } from "../mocks/types";
import { bankTasks } from "./bank";
import { answerText, checkAnswer, isAutoChecked } from "./check";
import type { AnswerResponse, TaskItem } from "./types";

/**
 * «Мои задания»: сохранённые из черновика задания и тесты, их выдача ученикам и попытки (TASKS-5…7).
 * В демо — в памяти; выданное сразу видно в мониторинге ученика и в его кабинете.
 */

export type WorkKind = "homework" | "test";
export type TestMode = "training" | "control";
export type TestSettings = { mode: TestMode; timeLimitMin: number | null; attempts: number | null };
export type HomeworkFormat = "online" | "print";
export type RevealMode = "now" | "afterDue" | "afterCheck";

export type Work = { id: string; kind: WorkKind; title: string; items: TaskItem[]; createdAt: string; test?: TestSettings; format?: HomeworkFormat };

export type TaskResult = { correct: boolean | null; points: number };

export type Attempt = {
  startedAt: number;
  finishedAt: number;
  answers: Record<string, AnswerResponse>;
  results: Record<string, TaskResult>;
};

export type AssignmentStatus = "todo" | "wait" | "done";

export type Assignment = { id: string; workId: string; studentId: string; assignedAt: string; due: string; reveal: RevealMode; status: AssignmentStatus; attempts: Attempt[] };

type LibraryState = { works: Work[]; assignments: Assignment[] };

const pickBank = (ids: string[]) => bankTasks.filter((task) => ids.includes(task.id));

let state: LibraryState = {
  works: [
    { id: "w-1", kind: "homework", title: "Уравнения: повторение", items: pickBank(["bank-6", "bank-8", "bank-10", "bank-12", "bank-19"]), createdAt: "2026-11-10", format: "online" },
    { id: "w-2", kind: "test", title: "Вероятность: тренажёр", items: pickBank(["bank-4", "bank-5", "bank-23"]), createdAt: "2026-11-12", test: { mode: "training", timeLimitMin: null, attempts: null } },
    { id: "w-3", kind: "test", title: "Русский: ударения и корни", items: pickBank(["bank-25", "bank-27", "bank-28"]), createdAt: "2026-11-14", test: { mode: "control", timeLimitMin: 15, attempts: 1 } },
  ],
  assignments: [],
};
let nextId = 1;
const listeners = new Set<() => void>();

function set(next: LibraryState) {
  state = next;
  for (const listener of listeners) listener();
}

export function subscribeLibrary(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getLibrary(): LibraryState {
  return state;
}

export function useLibrary(): LibraryState {
  return useSyncExternalStore(subscribeLibrary, getLibrary);
}

export function saveWork(work: Omit<Work, "id">): Work {
  const saved: Work = { ...work, id: `w-new-${nextId++}` };
  set({ ...state, works: [saved, ...state.works] });
  return saved;
}

export function removeWork(id: string): void {
  set({ works: state.works.filter((work) => work.id !== id), assignments: state.assignments.filter((assignment) => assignment.workId !== id) });
}

export type AssignOptions = { studentIds: string[]; due: string; reveal: RevealMode; today: string };

/** Выдать: по записи на ученика; повторная выдача того же — новая запись (новый срок, новые попытки). */
export function assignWork(workId: string, options: AssignOptions): Assignment[] {
  const created = options.studentIds.map((studentId) => ({
    id: `a-${nextId++}`,
    workId,
    studentId,
    assignedAt: options.today,
    due: options.due,
    reveal: options.reveal,
    status: "todo" as const,
    attempts: [],
  }));
  set({ ...state, assignments: [...created, ...state.assignments] });
  return created;
}

/** Проверка попытки: автопроверяемые — сразу, развёрнутые ждут репетитора (null). */
export function gradeAttempt(items: TaskItem[], answers: Record<string, AnswerResponse>): Record<string, TaskResult> {
  const results: Record<string, TaskResult> = {};
  for (const task of items) {
    const answer = answers[task.id];
    const correct = answer ? checkAnswer(task.answer, answer) : task.answer.kind === "extended" ? null : false;
    results[task.id] = { correct, points: correct === true ? task.points : 0 };
  }
  return results;
}

export type AttemptScore = { correct: number; total: number; points: number; maxPoints: number; pending: number; percent: number | null };

export function attemptScore(items: TaskItem[], results: Record<string, TaskResult>): AttemptScore {
  const auto = items.filter((task) => task.answer.kind !== "extended");
  const correct = auto.filter((task) => results[task.id]?.correct === true).length;
  const points = items.reduce((sum, task) => sum + (results[task.id]?.points ?? 0), 0);
  return {
    correct,
    total: auto.length,
    points,
    maxPoints: items.reduce((sum, task) => sum + task.points, 0),
    pending: items.filter((task) => results[task.id]?.correct === null).length,
    percent: auto.length > 0 ? Math.round((correct / auto.length) * 100) : null,
  };
}

export function submitAttempt(assignmentId: string, items: TaskItem[], answers: Record<string, AnswerResponse>, startedAt: number, finishedAt: number): Attempt {
  const attempt: Attempt = { startedAt, finishedAt, answers, results: gradeAttempt(items, answers) };
  const pending = Object.values(attempt.results).some((result) => result.correct === null);
  set({
    ...state,
    assignments: state.assignments.map((assignment) => (assignment.id === assignmentId ? { ...assignment, attempts: [...assignment.attempts, attempt], status: pending ? "wait" : "done" } : assignment)),
  });
  return attempt;
}

export function workOf(id: string): Work | undefined {
  return state.works.find((work) => work.id === id);
}

/** Можно ли начать ещё одну попытку теста. */
export function canStart(assignment: Assignment, work: Work): boolean {
  if (work.kind === "homework") return assignment.attempts.length === 0;
  const limit = work.test?.attempts ?? null;
  return limit === null || assignment.attempts.length < limit;
}

/** Тест — только задачи с автопроверкой; остальные надо убрать или заменить (TASKS-5). */
export function notForTest(items: TaskItem[]): TaskItem[] {
  return items.filter((task) => !isAutoChecked(task));
}

function responseText(response: AnswerResponse | undefined): string {
  if (!response) return "—";
  switch (response.kind) {
    case "number":
    case "text":
      return response.value || "—";
    case "choice":
      return response.selected.map((index) => index + 1).join("") || "—";
    case "match":
      return response.pairs.map((index) => (index === null ? "?" : index + 1)).join("");
    case "extended":
      return `фото: ${response.photos.length}`;
  }
}

const day = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Выданное ученику — в его мониторинг (вкладка «Задания» карточки ученика). */
export function assignedTasksOf(studentId: string): AssignedTask[] {
  return state.assignments
    .filter((assignment) => assignment.studentId === studentId)
    .flatMap((assignment) => {
      const work = workOf(assignment.workId);
      if (!work) return [];
      const last = assignment.attempts.at(-1);
      const score = last ? attemptScore(work.items, last.results) : null;
      const mistakes: TaskMistake[] = last
        ? work.items.flatMap((task, index) =>
            last.results[task.id]?.correct === false ? [{ number: String(task.number ?? index + 1), topic: task.topic, answer: responseText(last.answers[task.id]), correct: answerText(task.answer) }] : [],
          )
        : [];
      return [
        {
          title: work.kind === "test" ? `${work.title} · тест` : work.title,
          status: assignment.status,
          assignedAt: assignment.assignedAt,
          due: assignment.due,
          submittedAt: last ? day(last.finishedAt) : undefined,
          timeMin: last ? Math.max(1, Math.round((last.finishedAt - last.startedAt) / 60_000)) : undefined,
          score: score && score.total > 0 && assignment.status === "done" ? { correct: score.correct, total: score.total } : null,
          mistakes: assignment.status === "done" ? mistakes : [],
        },
      ];
    });
}

/** Средний результат по сделанным выдачам задания. */
export function workAverage(workId: string): number | null {
  const work = workOf(workId);
  if (!work) return null;
  const percents = state.assignments
    .filter((assignment) => assignment.workId === workId && assignment.attempts.length > 0)
    .map((assignment) => attemptScore(work.items, (assignment.attempts.at(-1) as Attempt).results).percent)
    .filter((percent): percent is number => percent !== null);
  return percents.length > 0 ? Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length) : null;
}
