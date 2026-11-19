import { request, requestAll } from "../../shared/api/client";
import type { LessonOutcome } from "../mocks/types";

/**
 * Общее для трёх кабинетов по docs/api/lessons.md: запросы переноса, предупреждения о неявке и лента событий урока.
 * Право решить или отозвать определяет сервер — флаги can_resolve и can_withdraw, как во фронтенде бэкенда.
 */

export type CabinetRole = "teacher" | "student" | "parent";
export type RequesterRole = CabinetRole;

export type RescheduleRequest = {
  id: string;
  scope: "one" | "following";
  requesterRole: RequesterRole;
  occurrences: { lessonId: string; startsAt: string; proposedStartsAt: string }[];
  reason: string | null;
  status: "pending" | "accepted" | "declined" | "withdrawn" | "expired" | "superseded";
  version: number;
  canResolve: boolean;
  canWithdraw: boolean;
};

type RescheduleRequestView = {
  request_id: string;
  scope: "one" | "following";
  requester_role: RequesterRole;
  occurrences: { lesson_id: string; starts_at: string; proposed_starts_at: string }[];
  reason: string | null;
  status: RescheduleRequest["status"];
  version: number;
  can_resolve?: boolean;
  can_withdraw?: boolean;
};

export type AbsenceNotice = { id: string; requesterRole: RequesterRole; reason: string | null; status: "open" | "closed" | "withdrawn"; version: number; canWithdraw: boolean };
type AbsenceNoticeView = { notice_id: string; requester_role: RequesterRole; reason: string | null; status: AbsenceNotice["status"]; version: number; can_withdraw?: boolean };

/** Урок в кабинете ученика или родителя (CabinetLesson): без закрытой заметки и полей серии. */
export type CabinetLesson = {
  id: string;
  cardId: string;
  startsAt: string;
  endsAt: string;
  durationMinutes: number;
  status: LessonOutcome;
  title: string;
  description: string | null;
  preparation: string | null;
  outcomeReason: string | null;
  version: number;
};
type CabinetLessonView = {
  lesson_id: string;
  student_card_id: string;
  starts_at: string;
  ends_at: string;
  duration_minutes: number;
  status: LessonOutcome;
  title: string;
  description: string | null;
  preparation: string | null;
  outcome_reason: string | null;
  version: number;
};

export type LessonActivity = { event: string; occurredAt: string; actorRole: RequesterRole | null };

const toRequest = (view: RescheduleRequestView): RescheduleRequest => ({
  id: view.request_id,
  scope: view.scope,
  requesterRole: view.requester_role,
  occurrences: view.occurrences.map((item) => ({ lessonId: item.lesson_id, startsAt: item.starts_at, proposedStartsAt: item.proposed_starts_at })),
  reason: view.reason,
  status: view.status,
  version: view.version,
  canResolve: view.can_resolve ?? false,
  canWithdraw: view.can_withdraw ?? false,
});

const toNotice = (view: AbsenceNoticeView): AbsenceNotice => ({
  id: view.notice_id,
  requesterRole: view.requester_role,
  reason: view.reason,
  status: view.status,
  version: view.version,
  canWithdraw: view.can_withdraw ?? false,
});

const toCabinetLesson = (view: CabinetLessonView): CabinetLesson => ({
  id: view.lesson_id,
  cardId: view.student_card_id,
  startsAt: view.starts_at,
  endsAt: view.ends_at,
  durationMinutes: view.duration_minutes,
  status: view.status,
  title: view.title,
  description: view.description,
  preparation: view.preparation,
  outcomeReason: view.outcome_reason,
  version: view.version,
});

const lessonBase = (role: CabinetRole, lessonId: string) => `/${role}/lessons/${encodeURIComponent(lessonId)}`;
const withReason = (reason: string) => (reason.trim() ? { reason: reason.trim() } : {});

export const lessonRequestsApi = {
  requests: async (role: CabinetRole, lessonId: string) => (await requestAll<RescheduleRequestView>(`${lessonBase(role, lessonId)}/reschedule-requests`)).map(toRequest),
  resolve: async (role: CabinetRole, item: RescheduleRequest, decision: "accept" | "decline") =>
    toRequest(await request<RescheduleRequestView>(`/${role}/reschedule-requests/${encodeURIComponent(item.id)}/resolve`, "POST", { decision, expected_version: item.version })),
  withdraw: async (role: CabinetRole, item: RescheduleRequest) =>
    toRequest(await request<RescheduleRequestView>(`/${role}/reschedule-requests/${encodeURIComponent(item.id)}/withdraw`, "POST", { expected_version: item.version })),

  notices: async (role: CabinetRole, lessonId: string) => (await requestAll<AbsenceNoticeView>(`${lessonBase(role, lessonId)}/absence-notices`)).map(toNotice),
  /** Предупредить о неявке может только ученик или родитель; это не отмена урока. */
  sendNotice: async (role: "student" | "parent", lesson: { id: string; version: number }, reason: string) =>
    toNotice(await request<AbsenceNoticeView>(`${lessonBase(role, lesson.id)}/absence-notices`, "POST", { expected_version: lesson.version, ...withReason(reason) })),
  withdrawNotice: async (role: CabinetRole, notice: AbsenceNotice) =>
    toNotice(await request<AbsenceNoticeView>(`/${role}/absence-notices/${encodeURIComponent(notice.id)}/withdraw`, "POST", { expected_version: notice.version })),

  /** Семейный запрос переноса наследует длительность урока. */
  proposeFamily: async (role: "student" | "parent", lesson: { id: string; version: number }, proposedStartsAt: string, reason: string) =>
    toRequest(await request<RescheduleRequestView>(`${lessonBase(role, lesson.id)}/reschedule-requests`, "POST", { proposed_starts_at: proposedStartsAt, expected_version: lesson.version, ...withReason(reason) })),

  lessons: async (role: "student" | "parent", from: string, to: string) => (await requestAll<CabinetLessonView>(`/${role}/lessons`, { from, to })).map(toCabinetLesson),
  lesson: async (role: "student" | "parent", id: string) => toCabinetLesson(await request<CabinetLessonView>(lessonBase(role, id))),
  activity: async (role: CabinetRole, lessonId: string): Promise<LessonActivity[]> =>
    (await requestAll<{ event: string; occurred_at: string; actor_role?: RequesterRole | null }>(`${lessonBase(role, lessonId)}/activity`)).map((item) => ({ event: item.event, occurredAt: item.occurred_at, actorRole: item.actor_role ?? null })),
};
