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
  preparation: string | null;
  privateNote: string | null;
  outcomeReason: string | null;
  seriesId: string | null;
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
  preparation: string | null;
  private_note: string | null;
  outcome_reason: string | null;
  series_id: string | null;
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
  preparation: view.preparation,
  privateNote: view.private_note,
  outcomeReason: view.outcome_reason,
  seriesId: view.series_id,
  version: view.version,
});

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
};

export type LessonsErrorCode = "timeConflict" | "notLinked" | "stateConflict" | "versionConflict" | "createConflict" | "validation" | "notFound" | "tooManyRequests" | "unavailable";

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
    case "validation_failed":
      return "validation";
    case "resource_not_found":
      return "notFound";
  }
  if (error.status === 429) return "tooManyRequests";
  return "unavailable";
}
