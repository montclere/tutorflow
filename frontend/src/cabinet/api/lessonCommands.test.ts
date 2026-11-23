import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { clearApiContext } from "../../shared/api/client";
import { lessonRequestsApi, type RescheduleRequest } from "./lessonRequests";
import { lessonsApi, type LiveLesson, type LiveSeries } from "./lessons";

type Call = { url: string; method: string; body: unknown; headers: Headers };
let calls: Call[];
let responses: Response[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const lessonView = { lesson_id: "l1", student_card_id: "c1", starts_at: "2026-11-23T10:00:00Z", ends_at: "2026-11-23T11:00:00Z", duration_minutes: 60, status: "scheduled", title: "Н и НН", description: null, preparation: null, private_note: null, outcome_reason: null, series_id: "s1", series_position: 3, version: 4 };
const lesson = { id: "l1", version: 4, seriesPosition: 3 } as LiveLesson;
const series = { id: "s1", version: 7, timezone: "Asia/Novosibirsk" } as LiveSeries;
const seriesView = { series_id: "s1", timezone: "Asia/Novosibirsk", version: 8, content_template: { title: "Н и НН" }, lessons: [lessonView] };
const requestView = { request_id: "r1", scope: "one", requester_role: "student", occurrences: [{ lesson_id: "l1", starts_at: "2026-11-23T10:00:00Z", proposed_starts_at: "2026-11-24T10:00:00Z" }], reason: null, status: "pending", version: 1, can_resolve: true };

beforeEach(() => {
  clearApiContext();
  calls = [];
  responses = [json({ csrf_token: "t" })];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined, headers: new Headers(init.headers) });
    return responses.shift();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("команды урока и серии (как во фронтенде бэкенда)", () => {
  it("удаление — DELETE с сильным ETag версии в If-Match", async () => {
    responses.push(new Response(null, { status: 204 }));
    await lessonsApi.remove(lesson);
    expect(calls[1]).toMatchObject({ url: "/api/v1/teacher/lessons/l1", method: "DELETE" });
    expect(calls[1]?.headers.get("If-Match")).toBe('"4"');
  });

  it("перенос одного урока — предложение с версией урока; пустая причина не уходит", async () => {
    responses.push(json(requestView, 201));
    await lessonsApi.propose(lesson, "2026-11-24T10:00:00Z", 60, "  ");
    expect(calls[1]).toMatchObject({ url: "/api/v1/teacher/lessons/l1/reschedule-requests", method: "POST" });
    expect(calls[1]?.body).toEqual({ proposed_starts_at: "2026-11-24T10:00:00Z", duration_minutes: 60, expected_version: 4 });
  });

  it("перенос «этот и следующие» — предпросмотр по версии серии", async () => {
    responses.push(json({ occurrences: [{ series_position: 3, starts_at: "2026-11-24T10:00:00Z", conflicts: true }], preserved_lesson_ids: ["l9"] }));
    const plan = await lessonsApi.previewSeriesMove(series, "l1", "2026-11-24T17:00", 60);
    expect(calls[1]?.body).toEqual({ from_lesson_id: "l1", first_local_start: "2026-11-24T17:00", duration_minutes: 60, expected_version: 7 });
    expect(plan).toEqual({ occurrences: [{ position: 3, startsAt: "2026-11-24T10:00:00Z", conflicts: true }], preserved: 1 });
  });

  it("отмена серии: «все будущие» без from_lesson_id, «этот и следующие» — с ним", async () => {
    responses.push(json(seriesView), json(seriesView));
    await lessonsApi.cancelSeries(series, "all_future", "l1", "");
    await lessonsApi.cancelSeries(series, "following", "l1", "болеет");
    expect(calls[1]?.body).toEqual({ scope: "all_future", expected_version: 7 });
    expect(calls[2]?.body).toEqual({ scope: "following", expected_version: 7, from_lesson_id: "l1", reason: "болеет" });
  });

  it("правка содержания: null очищает поле, неизменённые поля не уходят", async () => {
    responses.push(json({ ...lessonView, preparation: null, version: 5 }));
    const changed = await lessonsApi.update(lesson, { preparation: null, privateNote: "повторить" });
    expect(calls[1]).toMatchObject({ url: "/api/v1/teacher/lessons/l1", method: "PATCH" });
    expect(calls[1]?.body).toEqual({ preparation: null, private_note: "повторить", expected_version: 4 });
    expect(changed).toMatchObject({ version: 5, seriesPosition: 3, isSeriesException: false });
  });

  it("проведённый задним числом — отдельный маршрут record-completed", async () => {
    responses.push(json({ ...lessonView, status: "completed" }, 201));
    const recorded = await lessonsApi.recordCompleted({ cardId: "c1", startsAt: "2026-11-10T10:00:00Z", durationMinutes: 60, title: "Тема", clientRequestId: "k" });
    expect(calls[1]?.url).toBe("/api/v1/teacher/lessons/record-completed");
    expect(recorded.status).toBe("completed");
  });
});

describe("запросы переноса и предупреждения — общие для кабинетов", () => {
  it("решение по запросу — выбор и версия запроса; право решить приходит с сервера", async () => {
    responses = [json({ items: [requestView], next_cursor: null }), json({ csrf_token: "t" }), json({ ...requestView, status: "accepted", version: 2 })];
    const [item] = await lessonRequestsApi.requests("teacher", "l1");
    expect(item).toMatchObject({ canResolve: true, canWithdraw: false, requesterRole: "student" });
    const resolved = await lessonRequestsApi.resolve("teacher", item as RescheduleRequest, "accept");
    expect(calls[2]).toMatchObject({ url: "/api/v1/teacher/reschedule-requests/r1/resolve", body: { decision: "accept", expected_version: 1 } });
    expect(resolved.status).toBe("accepted");
  });

  it("ученик предлагает перенос без длительности и предупреждает о неявке по версии урока", async () => {
    responses.push(json(requestView, 201), json({ notice_id: "n1", requester_role: "student", reason: "олимпиада", status: "open", version: 1 }, 201));
    await lessonRequestsApi.proposeFamily("student", { id: "l1", version: 4 }, "2026-11-24T10:00:00Z", "");
    const notice = await lessonRequestsApi.sendNotice("student", { id: "l1", version: 4 }, "олимпиада");
    expect(calls[1]).toMatchObject({ url: "/api/v1/student/lessons/l1/reschedule-requests", body: { proposed_starts_at: "2026-11-24T10:00:00Z", expected_version: 4 } });
    expect(calls[2]).toMatchObject({ url: "/api/v1/student/lessons/l1/absence-notices", body: { expected_version: 4, reason: "олимпиада" } });
    expect(notice).toMatchObject({ id: "n1", status: "open", canWithdraw: false });
  });
});
