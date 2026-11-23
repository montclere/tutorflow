import { useCallback, useEffect, useState } from "react";
import { lessonsApi, type LiveLesson } from "../../../api/lessons";
import { studentsApi, type TeacherCard } from "../../../api/students";
import { addDays } from "../../../model/dates";
import type { DateRange } from "../../../model/scheduleRange";
import { zonedToUtc } from "../../../model/zoned";

export type LiveScheduleState = { kind: "loading" } | { kind: "failed" } | { kind: "ready"; lessons: LiveLesson[]; cards: TeacherCard[] };

/** Окно календаря: от начала первого дня до начала дня после последнего — на часах зоны профиля. */
export function windowOf(range: DateRange, timeZone: string): { from: string; to: string } {
  return { from: zonedToUtc(range.from, "00:00", timeZone), to: zonedToUtc(addDays(range.to, 1), "00:00", timeZone) };
}

/** Заменить урок после действия; уроки, которых не было, — добавить (например, новая серия). */
export function mergeLessons(current: LiveLesson[], changed: LiveLesson[]): LiveLesson[] {
  const byId = new Map(current.map((lesson) => [lesson.id, lesson]));
  for (const lesson of changed) byId.set(lesson.id, lesson);
  return [...byId.values()].sort((a, b) => a.startsAt.localeCompare(b.startsAt));
}

/**
 * Уроки открытого окна и карточки (имена, кому можно поставить урок). После изменения расписания
 * сервер не даёт снимка между страницами — окно загружается заново (docs/api/lessons.md).
 */
export function useLiveSchedule(range: DateRange, timeZone: string) {
  const [state, setState] = useState<LiveScheduleState>({ kind: "loading" });
  const { from, to } = windowOf(range, timeZone);

  const load = useCallback(async () => {
    try {
      // Архивные карточки — ради имён в прошлых уроках.
      const [lessons, active, archived] = await Promise.all([lessonsApi.list(from, to), studentsApi.cards("active"), studentsApi.cards("archived")]);
      setState({ kind: "ready", lessons, cards: [...active, ...archived] });
    } catch {
      setState((current) => (current.kind === "ready" ? current : { kind: "failed" }));
    }
  }, [from, to]);

  useEffect(() => {
    // Окно — внешний источник; состояние выставляется после ответа сервера.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  const retry = () => {
    setState({ kind: "loading" });
    void load();
  };

  const apply = (changed: LiveLesson[]) => setState((current) => (current.kind === "ready" ? { ...current, lessons: mergeLessons(current.lessons, changed) } : current));

  return { state, reload: load, retry, apply };
}
