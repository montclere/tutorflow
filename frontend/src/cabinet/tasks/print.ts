import { useSyncExternalStore } from "react";
import type { TaskItem } from "./types";

/** Печать листа (PDF через «Сохранить как PDF» в браузере): один шаблон для всех предметов (TASKS-9). */
export type PrintVariant = "student" | "answers" | "blank";
export type PrintJob = { title: string; items: TaskItem[]; variant: PrintVariant; studentName?: string; due?: string; subtitle?: string };

let job: PrintJob | null = null;
const listeners = new Set<() => void>();

function set(next: PrintJob | null) {
  job = next;
  for (const listener of listeners) listener();
}

export function requestPrint(next: PrintJob): void {
  set(next);
}

export function clearPrint(): void {
  set(null);
}

export function usePrintJob(): PrintJob | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => job,
  );
}
