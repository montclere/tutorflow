import { useSyncExternalStore } from "react";
import { bankTasks } from "./bank";
import { estimateMinutes, isAutoChecked } from "./check";
import type { SubjectId, TaskItem } from "./types";

/** Черновик — одна «корзина» на весь раздел «Задания»: из банка, от ИИ и вручную (TASKS-1). В демо — в памяти. */
export type Draft = { title: string; items: TaskItem[] };

export const DRAFT_LIMIT = 30;

const initialIds = ["bank-6", "bank-8", "bank-10", "bank-19"];
let draft: Draft = { title: "Уравнения: показательные и логарифмические", items: bankTasks.filter((task) => initialIds.includes(task.id)) };
const listeners = new Set<() => void>();

function set(next: Draft) {
  draft = next;
  for (const listener of listeners) listener();
}

export function getDraft(): Draft {
  return draft;
}

export function subscribeDraft(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDraft(): Draft {
  return useSyncExternalStore(subscribeDraft, getDraft);
}

/** Добавить задачи без повторов и не больше лимита; вернуть, сколько добавлено. */
export function addToDraft(tasks: TaskItem[]): number {
  const ids = new Set(draft.items.map((task) => task.id));
  const fresh = tasks
    .filter((task) => {
      if (ids.has(task.id)) return false;
      ids.add(task.id);
      return true;
    })
    .slice(0, Math.max(0, DRAFT_LIMIT - draft.items.length));
  if (fresh.length > 0) set({ ...draft, items: [...draft.items, ...fresh] });
  return fresh.length;
}

export function removeFromDraft(id: string): void {
  set({ ...draft, items: draft.items.filter((task) => task.id !== id) });
}

export function moveInDraft(id: string, direction: -1 | 1): void {
  const index = draft.items.findIndex((task) => task.id === id);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= draft.items.length) return;
  const items = [...draft.items];
  [items[index], items[target]] = [items[target] as TaskItem, items[index] as TaskItem];
  set({ ...draft, items });
}

export function replaceInDraft(id: string, task: TaskItem): void {
  set({ ...draft, items: draft.items.map((item) => (item.id === id ? task : item)) });
}

export function setDraftItems(items: TaskItem[]): void {
  set({ ...draft, items: items.slice(0, DRAFT_LIMIT) });
}

export function setDraftTitle(title: string): void {
  set({ ...draft, title });
}

/** Начать черновик заново — например, из сохранённого задания. */
export function loadDraft(next: Draft): void {
  set({ title: next.title, items: next.items.slice(0, DRAFT_LIMIT) });
}

export function clearDraft(): void {
  set({ title: "", items: [] });
}

export type DraftSummary = { count: number; points: number; minutes: number; auto: number; subjects: SubjectId[] };

export function draftSummary(items: TaskItem[]): DraftSummary {
  return {
    count: items.length,
    points: items.reduce((sum, task) => sum + task.points, 0),
    minutes: estimateMinutes(items),
    auto: items.filter(isAutoChecked).length,
    subjects: [...new Set(items.map((task) => task.subject))],
  };
}
