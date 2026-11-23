import { MAX_DURATION_MIN, MIN_DURATION_MIN } from "./newLesson";

/** Черновик урока рабочей сборки: тема обязательна, серия — одно и то же время раз в неделю (docs/api/lessons.md). */
export type LiveDraft = {
  cardId: string | null;
  title: string;
  date: string;
  start: string;
  durationMin: number;
  repeat: boolean;
  count: number;
  /** Урок уже прошёл — записать сразу проведённым с фактическим временем (LES-43). */
  recorded?: boolean;
};

export type LiveDraftError = "student" | "topic" | "past" | "future" | "duration" | "count";

export const MIN_SERIES_COUNT = 2;
export const MAX_SERIES_COUNT = 26;
export const TITLE_MAX = 120;

export function liveDraftErrors(draft: LiveDraft, today: string, now: string): LiveDraftError[] {
  const errors: LiveDraftError[] = [];
  if (!draft.cardId) errors.push("student");
  if (draft.title.trim() === "") errors.push("topic");
  const inPast = draft.date < today || (draft.date === today && draft.start <= now);
  if (draft.recorded) {
    if (!inPast) errors.push("future");
  } else if (inPast) errors.push("past");
  if (!Number.isInteger(draft.durationMin) || draft.durationMin < MIN_DURATION_MIN || draft.durationMin > MAX_DURATION_MIN) errors.push("duration");
  if (draft.repeat && !draft.recorded && (!Number.isInteger(draft.count) || draft.count < MIN_SERIES_COUNT || draft.count > MAX_SERIES_COUNT)) errors.push("count");
  return errors;
}

/**
 * Ключ попытки создания (LES-17): повтор тех же данных после потерянного ответа идёт с тем же ключом —
 * сервер вернёт уже созданное; изменённые данные получают новый ключ.
 */
export function attemptKey(previous: { key: string; payload: string } | null, payload: string, newKey: () => string): { key: string; payload: string } {
  return previous && previous.payload === payload ? previous : { key: newKey(), payload };
}
