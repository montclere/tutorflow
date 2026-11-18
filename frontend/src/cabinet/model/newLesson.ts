import type { LessonType, ScheduleLesson, WorkHours } from "../mocks/types";
import { addDays, daysBetween, parseDate, weekdayIndex } from "./dates";
import { lessonEnd } from "./lessons";
import { formatMinutes, toMinutes } from "./time";

export const TIME_STEP_MIN = 15;
export const MIN_DURATION_MIN = 15;
export const MAX_DURATION_MIN = 240;
const DAY_MINUTES = 24 * 60;
// Защита от случайной «бесконечной» серии: больше уроков за раз не создаём.
const MAX_SERIES = 200;

export type RepeatRule = { kind: "none" } | { kind: "weekly"; weekdays: number[]; until: string };

export type LessonDraft = {
  studentId: string | null;
  date: string;
  start: string;
  durationMin: number;
  type: LessonType;
  repeat: RepeatRule;
  link: string;
};

export type DraftError = "student" | "past" | "duration" | "outsideDay" | "weekdays" | "until";

export function draftDates(draft: LessonDraft): string[] {
  if (draft.repeat.kind === "none") return [draft.date];
  const { weekdays, until } = draft.repeat;
  const dates: string[] = [];
  for (let offset = 0; offset <= daysBetween(draft.date, until) && dates.length < MAX_SERIES; offset += 1) {
    const date = addDays(draft.date, offset);
    if (weekdays.includes(weekdayIndex(date))) dates.push(date);
  }
  return dates;
}

export function buildLessons(draft: LessonDraft, idPrefix: string): ScheduleLesson[] {
  if (!draft.studentId) return [];
  const studentId = draft.studentId;
  const link = draft.link.trim();
  return draftDates(draft).map((date, index) => ({
    id: `${idPrefix}-${index}`,
    studentId,
    date,
    start: draft.start,
    durationMin: draft.durationMin,
    type: draft.type,
    recurring: draft.repeat.kind === "weekly",
    ...(link ? { link } : {}),
  }));
}

function overlaps(a: ScheduleLesson, b: ScheduleLesson): boolean {
  if (a.date !== b.date) return false;
  return toMinutes(a.start) < toMinutes(lessonEnd(b)) && toMinutes(b.start) < toMinutes(lessonEnd(a));
}

export function findConflicts(candidates: ScheduleLesson[], existing: ScheduleLesson[]) {
  const conflicts: { candidate: ScheduleLesson; existing: ScheduleLesson }[] = [];
  for (const candidate of candidates) {
    for (const lesson of existing) if (overlaps(candidate, lesson)) conflicts.push({ candidate, existing: lesson });
  }
  return conflicts;
}

export function draftErrors(draft: LessonDraft, today: string, now: string): DraftError[] {
  const errors: DraftError[] = [];
  if (!draft.studentId) errors.push("student");
  if (draft.date < today || (draft.date === today && toMinutes(draft.start) < toMinutes(now))) errors.push("past");
  if (draft.durationMin < MIN_DURATION_MIN || draft.durationMin > MAX_DURATION_MIN) errors.push("duration");
  if (toMinutes(draft.start) + draft.durationMin > DAY_MINUTES) errors.push("outsideDay");
  if (draft.repeat.kind === "weekly") {
    if (draft.repeat.weekdays.length === 0) errors.push("weekdays");
    if (draft.repeat.until < draft.date) errors.push("until");
  }
  return errors;
}

function roundUp(minutes: number): number {
  return Math.ceil(minutes / TIME_STEP_MIN) * TIME_STEP_MIN;
}

/** Время по клику: начало сетки + номер часа + доля внутри часа, вниз до шага 15 минут. */
export function timeAtOffset(gridStart: string, hourIndex: number, fraction: number): string {
  const minuteInHour = Math.floor(Math.min(Math.max(fraction, 0), 0.999) * (60 / TIME_STEP_MIN)) * TIME_STEP_MIN;
  return formatMinutes(toMinutes(gridStart) + hourIndex * 60 + minuteInHour);
}

/** Время по клику внутри свободного окна: доля высоты окна, вниз до шага 15 минут. */
export function timeInWindow(start: string, end: string, fraction: number): string {
  const length = toMinutes(end) - toMinutes(start);
  const offset = Math.floor((Math.min(Math.max(fraction, 0), 0.999) * length) / TIME_STEP_MIN) * TIME_STEP_MIN;
  return formatMinutes(toMinutes(start) + offset);
}

/** Сегодня — ближайшее время после «сейчас», но не раньше начала рабочего дня; другой день — начало рабочего дня. */
export function defaultStart(work: WorkHours, date: string, today: string, now: string): string {
  const dayStart = toMinutes(work.start);
  if (date !== today) return work.start;
  return formatMinutes(Math.max(dayStart, roundUp(toMinutes(now))));
}

/** Конец учебного года для повтора по умолчанию — 31 мая ближайшего мая. */
export function schoolYearEnd(date: string): string {
  const parsed = parseDate(date);
  const year = parsed.getMonth() > 4 ? parsed.getFullYear() + 1 : parsed.getFullYear();
  return `${year}-05-31`;
}
