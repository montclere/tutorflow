import { ApiError, request, requestAll } from "../../shared/api/client";
import type { LessonOutcome, ScheduleLesson } from "../mocks/types";
import { zonedParts } from "../model/zoned";

/** Занятия репетитора по docs/api/lessons.md: календарь, разовый урок, серия, отмена и отметка. */

export type LiveLesson = {
  id: string;
  cardId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: LessonOutcome;
  title: string;
  description: string | null;
  preparation: string | null;
  privateNote: string | null;
  outcomeReason: string | null;
  seriesId: string | null;
  seriesPosition: number | null;
  isSeriesException: boolean;
  usesSeriesContent: boolean;
  version: number;
};

type TeacherLessonView = {
  lesson_id: string;
  student_card_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: LessonOutcome;
  title: string;
  description?: string | null;
  preparation: string | null;
  private_note: string | null;
  outcome_reason: string | null;
  series_id: string | null;
  series_position?: number | null;
  is_series_exception?: boolean;
  uses_series_content?: boolean;
  version: number;
};

const toLesson = (view: TeacherLessonView): LiveLesson => ({
  id: view.lesson_id,
  cardId: view.student_card_id,
  startsAt: view.starts_at,
  endsAt: view.ends_at,
  durationMinutes: view.duration_minutes,
  status: view.status,
  title: view.title,
  description: view.description ?? null,
  preparation: view.preparation,
  privateNote: view.private_note,
  outcomeReason: view.outcome_reason,
  seriesId: view.series_id,
  seriesPosition: view.series_position ?? null,
  isSeriesException: view.is_series_exception ?? false,
  usesSeriesContent: view.uses_series_content ?? false,
  version: view.version,
});

/** Серия: шаблон содержания и уроки по позициям (docs/api/lessons.md, «Команды для серии»). */
export type LiveSeries = { id: string; timezone: string; version: number; template: LessonContent; lessons: LiveLesson[] };
type TeacherSeriesView = { series_id: string; timezone: string; version: number; content_template: Partial<LessonContentView>; lessons: TeacherLessonView[] };

/** Содержание урока: тема, описание, подготовка для ученика и закрытая заметка репетитора. */
export type LessonContent = { title: string; description: string | null; preparation: string | null; privateNote: string | null };
type LessonContentView = { title: string; description: string | null; preparation: string | null; private_note: string | null };

const contentBody = (changes: Partial<LessonContent>) => ({
  ...(changes.title !== undefined ? { title: changes.title } : {}),
  ...(changes.description !== undefined ? { description: changes.description } : {}),
  ...(changes.preparation !== undefined ? { preparation: changes.preparation } : {}),
  ...(changes.privateNote !== undefined ? { private_note: changes.privateNote } : {}),
});

const toSeries = (view: TeacherSeriesView): LiveSeries => ({
  id: view.series_id,
  timezone: view.timezone,
  version: view.version,
  template: {
    title: view.content_template.title ?? "",
    description: view.content_template.description ?? null,
    preparation: view.content_template.preparation ?? null,
    privateNote: view.content_template.private_note ?? null,
  },
  lessons: view.lessons.map(toLesson),
});

/** Запись истории урока для репетитора (LessonChange): событие, когда, что было и что стало. */
export type LessonChange = {
  version: number;
  event: string;
  occurredAt: string;
  before: { starts_at?: string; status?: string } | null;
  after: { starts_at?: string; status?: string } | null;
  changedFields: string[];
  reason: string | null;
};
type LessonChangeView = { version: number; event: string; occurred_at: string; before: LessonChange["before"]; after: (LessonChange["after"] & { changed_fields?: string[]; reason?: string | null }) | null; changed_fields?: string[]; reason?: string | null };

/** Предпросмотр переноса серии: даты «этот и следующие», занятые интервалы и сохраняемые уроки. */
export type ReschedulePlan = { occurrences: SeriesOccurrence[]; preserved: number };

/** Урок API — урок календаря на часах зоны профиля. */
export function toScheduleLesson(lesson: LiveLesson, timeZone: string): ScheduleLesson {
  const { date, time } = zonedParts(lesson.startsAt, timeZone);
  return {
    id: lesson.id,
    studentId: lesson.cardId,
    date,
    start: time,
    durationMin: lesson.durationMinutes,
    type: "individual",
    recurring: lesson.seriesId !== null,
    status: lesson.status,
  };
}

export type NewLessonInput = { cardId: string; startsAt: string; durationMinutes: number; title: string; clientRequestId: string };
export type NewSeriesInput = { cardId: string; firstLocalStart: string; timezone: string; count: number; durationMinutes: number; title: string; clientRequestId: string };
export type SeriesOccurrence = { position: number; startsAt: string; conflicts: boolean };

const lessonPath = (id: string) => `/teacher/lessons/${encodeURIComponent(id)}`;
const seriesPlan = (input: Omit<NewSeriesInput, "title" | "clientRequestId">) => ({
  student_card_id: input.cardId,
  first_local_start: input.firstLocalStart,
  timezone: input.timezone,
  count: input.count,
  duration_minutes: input.durationMinutes,
});

/** Максимум окна календаря — 62 суток (docs/api/lessons.md). */
export const MAX_WINDOW_DAYS = 62;

export const lessonsApi = {
  list: async (from: string, to: string) => (await requestAll<TeacherLessonView>("/teacher/lessons", { from, to })).map(toLesson),

  create: async (input: NewLessonInput) =>
    toLesson(
      await request<TeacherLessonView>("/teacher/lessons", "POST", {
        student_card_id: input.cardId,
        starts_at: input.startsAt,
        duration_minutes: input.durationMinutes,
        title: input.title,
        client_request_id: input.clientRequestId,
      }),
    ),

  previewSeries: async (input: Omit<NewSeriesInput, "title" | "clientRequestId">) => {
    const plan = await request<{ occurrences: { series_position: number; starts_at: string; conflicts: boolean }[] }>("/teacher/lesson-series/preview", "POST", seriesPlan(input));
    return plan.occurrences.map((item) => ({ position: item.series_position, startsAt: item.starts_at, conflicts: item.conflicts }) satisfies SeriesOccurrence);
  },

  createSeries: async (input: NewSeriesInput) => {
    const series = await request<{ lessons: TeacherLessonView[] }>("/teacher/lesson-series", "POST", { ...seriesPlan(input), title: input.title, client_request_id: input.clientRequestId });
    return series.lessons.map(toLesson);
  },

  cancel: async (lesson: LiveLesson, reason?: string) =>
    toLesson(await request<TeacherLessonView>(`${lessonPath(lesson.id)}/cancel`, "POST", { expected_version: lesson.version, ...(reason?.trim() ? { reason: reason.trim() } : {}) })),

  /** Причина допускается только для неявки. */
  attendance: async (lesson: LiveLesson, status: "completed" | "no_show", reason?: string) =>
    toLesson(
      await request<TeacherLessonView>(`${lessonPath(lesson.id)}/attendance`, "POST", {
        status,
        expected_version: lesson.version,
        ...(status === "no_show" && reason?.trim() ? { reason: reason.trim() } : {}),
      }),
    ),

  resetAttendance: async (lesson: LiveLesson) => toLesson(await request<TeacherLessonView>(`${lessonPath(lesson.id)}/attendance/reset`, "POST", { expected_version: lesson.version })),

  restore: async (lesson: LiveLesson) => toLesson(await request<TeacherLessonView>(`${lessonPath(lesson.id)}/restore`, "POST", { expected_version: lesson.version })),

  get: async (id: string) => toLesson(await request<TeacherLessonView>(lessonPath(id))),

  /** Урок, который уже прошёл: запись сразу в состоянии «проведён» с фактическим временем (LES-43). */
  recordCompleted: async (input: NewLessonInput) =>
    toLesson(
      await request<TeacherLessonView>("/teacher/lessons/record-completed", "POST", {
        student_card_id: input.cardId,
        starts_at: input.startsAt,
        duration_minutes: input.durationMinutes,
        title: input.title,
        client_request_id: input.clientRequestId,
      }),
    ),

  /** Правка содержания одного урока (LES-48); null очищает необязательный текст. */
  update: async (lesson: LiveLesson, changes: Partial<LessonContent>) =>
    toLesson(await request<TeacherLessonView>(lessonPath(lesson.id), "PATCH", { ...contentBody(changes), expected_version: lesson.version })),

  /** Удаление — с сильным ETag версии в If-Match, как в решении бэкенда. */
  remove: async (lesson: LiveLesson) => request<void>(lessonPath(lesson.id), "DELETE", undefined, { headers: { "If-Match": `"${lesson.version}"` } }),

  history: async (id: string): Promise<LessonChange[]> =>
    (await requestAll<LessonChangeView>(`${lessonPath(id)}/history`)).map((item) => ({
      version: item.version,
      event: item.event,
      occurredAt: item.occurred_at,
      before: item.before,
      after: item.after,
      changedFields: item.changed_fields ?? item.after?.changed_fields ?? [],
      reason: item.reason ?? item.after?.reason ?? null,
    })),

  /** Предложить перенос одного урока: ученик или родитель принимает или отклоняет (LES-34). */
  propose: async (lesson: LiveLesson, startsAt: string, durationMinutes: number, reason: string) =>
    request<unknown>(`${lessonPath(lesson.id)}/reschedule-requests`, "POST", {
      proposed_starts_at: startsAt,
      duration_minutes: durationMinutes,
      expected_version: lesson.version,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    }),

  series: async (id: string) => toSeries(await request<TeacherSeriesView>(`/teacher/lesson-series/${encodeURIComponent(id)}`)),

  /** Правка шаблона серии — меняет будущие уроки, которые от него зависят (LES-54). */
  updateSeriesContent: async (series: LiveSeries, changes: Partial<LessonContent>) =>
    toSeries(await request<TeacherSeriesView>(`/teacher/lesson-series/${encodeURIComponent(series.id)}/content`, "PATCH", { ...contentBody(changes), expected_version: series.version })),

  /** Отмена будущих дат серии: все будущие или «этот и следующие» (LES-24, LES-55). */
  cancelSeries: async (series: LiveSeries, scope: "all_future" | "following", fromLessonId: string | null, reason: string) =>
    toSeries(
      await request<TeacherSeriesView>(`/teacher/lesson-series/${encodeURIComponent(series.id)}/cancel`, "POST", {
        scope,
        expected_version: series.version,
        ...(scope === "following" && fromLessonId ? { from_lesson_id: fromLessonId } : {}),
        ...(reason.trim() ? { reason: reason.trim() } : {}),
      }),
    ),

  /** Предпросмотр переноса «этот и следующие» — сервер считает даты и конфликты (LES-20). */
  previewSeriesMove: async (series: LiveSeries, fromLessonId: string, firstLocalStart: string, durationMinutes: number): Promise<ReschedulePlan> => {
    const plan = await request<{ occurrences: { series_position: number; starts_at: string; conflicts: boolean }[]; preserved_lesson_ids?: string[] }>(
      `/teacher/lesson-series/${encodeURIComponent(series.id)}/reschedule/preview`,
      "POST",
      { from_lesson_id: fromLessonId, first_local_start: firstLocalStart, duration_minutes: durationMinutes, expected_version: series.version },
    );
    return { occurrences: plan.occurrences.map((item) => ({ position: item.series_position, startsAt: item.starts_at, conflicts: item.conflicts })), preserved: plan.preserved_lesson_ids?.length ?? 0 };
  },

  proposeSeriesMove: async (series: LiveSeries, fromLessonId: string, firstLocalStart: string, durationMinutes: number, reason: string) =>
    request<unknown>(`/teacher/lesson-series/${encodeURIComponent(series.id)}/reschedule-requests`, "POST", {
      from_lesson_id: fromLessonId,
      first_local_start: firstLocalStart,
      duration_minutes: durationMinutes,
      expected_version: series.version,
      ...(reason.trim() ? { reason: reason.trim() } : {}),
    }),
};

export type LessonsErrorCode = "timeConflict" | "notLinked" | "stateConflict" | "versionConflict" | "createConflict" | "reschedulePending" | "absencePending" | "precondition" | "validation" | "notFound" | "tooManyRequests" | "unavailable";

export function lessonsErrorCode(error: unknown): LessonsErrorCode {
  if (!(error instanceof ApiError)) return "unavailable";
  switch (error.code) {
    case "lesson_time_conflict":
      return "timeConflict";
    case "lesson_student_not_linked":
      return "notLinked";
    case "lesson_state_conflict":
      return "stateConflict";
    case "version_conflict":
      return "versionConflict";
    case "lesson_create_conflict":
      return "createConflict";
    case "lesson_reschedule_pending":
      return "reschedulePending";
    case "lesson_absence_notice_pending":
      return "absencePending";
    case "precondition_failed":
    case "precondition_required":
      return "precondition";
    case "validation_failed":
      return "validation";
    case "resource_not_found":
      return "notFound";
  }
  if (error.status === 429) return "tooManyRequests";
  return "unavailable";
}
