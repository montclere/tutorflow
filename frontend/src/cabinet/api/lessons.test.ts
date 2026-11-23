import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearApiContext } from "../../shared/api/client";
import { lessonsApi, lessonsErrorCode, toScheduleLesson, type LiveLesson } from "./lessons";

type Call = { url: string; body: unknown };
let calls: Call[];
let responses: Response[];
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const view = {
  lesson_id: "l1",
  student_card_id: "c1",
  starts_at: "2026-11-23T10:00:00Z",
  ends_at: "2026-11-23T11:00:00Z",
  duration_minutes: 60,
  status: "scheduled",
  title: "Квадратные уравнения",
  description: null,
  preparation: null,
  private_note: null,
  outcome_reason: null,
  series_id: "s1",
  version: 2,
};

beforeEach(() => {
  clearApiContext();
  calls = [];
  responses = [json({ csrf_token: "t" })];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    return responses.shift();
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("lessonsApi", () => {
  it("календарь запрашивается окном UTC и переводится в часы профиля", async () => {
    responses = [json({ items: [view], next_cursor: null })];
    const [lesson] = await lessonsApi.list("2026-11-22T17:00:00Z", "2026-11-29T17:00:00Z");
    expect(calls[0]?.url).toBe("/api/v1/teacher/lessons?limit=100&from=2026-11-22T17%3A00%3A00Z&to=2026-11-29T17%3A00%3A00Z");
    expect(toScheduleLesson(lesson as LiveLesson, "Asia/Novosibirsk")).toMatchObject({ id: "l1", studentId: "c1", date: "2026-11-23", start: "17:00", durationMin: 60, recurring: true, status: "scheduled" });
  });

  it("разовый урок уходит с ключом попытки", async () => {
    responses.push(json(view, 201));
    await lessonsApi.create({ cardId: "c1", startsAt: "2026-11-23T10:00:00Z", durationMinutes: 60, title: "Тема", clientRequestId: "k1" });
    expect(calls[1]?.body).toEqual({ student_card_id: "c1", starts_at: "2026-11-23T10:00:00Z", duration_minutes: 60, title: "Тема", client_request_id: "k1" });
  });

  it("серия — локальное время и зона, без смещения", async () => {
    responses.push(json({ series_id: "s1", lessons: [view] }, 201));
    await lessonsApi.createSeries({ cardId: "c1", firstLocalStart: "2026-11-23T17:00", timezone: "Asia/Novosibirsk", count: 8, durationMinutes: 60, title: "Тема", clientRequestId: "k2" });
    expect(calls[1]?.body).toMatchObject({ first_local_start: "2026-11-23T17:00", timezone: "Asia/Novosibirsk", count: 8 });
  });

  it("причина неявки передаётся только для no_show", async () => {
    const lesson = { id: "l1", version: 2 } as LiveLesson;
    responses.push(json({ ...view, status: "completed" }), json({ ...view, status: "no_show" }));
    await lessonsApi.attendance(lesson, "completed", "болел");
    await lessonsApi.attendance(lesson, "no_show", " болел ");
    expect(calls[1]?.body).toEqual({ status: "completed", expected_version: 2 });
    expect(calls[2]?.body).toEqual({ status: "no_show", expected_version: 2, reason: "болел" });
  });

  it("коды ошибок календаря", () => {
    expect(lessonsErrorCode(new ApiError(409, "lesson_time_conflict"))).toBe("timeConflict");
    expect(lessonsErrorCode(new ApiError(409, "lesson_student_not_linked"))).toBe("notLinked");
    expect(lessonsErrorCode(new Error("x"))).toBe("unavailable");
  });
});
