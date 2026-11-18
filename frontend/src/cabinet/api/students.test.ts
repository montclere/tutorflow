import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearApiContext } from "../../shared/api/client";
import { editBody, studentsApi, studentsErrorCode, tokenFromHash, type TeacherCard } from "./students";

type Call = { url: string; method: string; body: unknown };

let calls: Call[];
let responses: Response[];

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const cardView = {
  student_card_id: "c1",
  student_card_name: "Маша",
  student_account_id: null,
  subject: "Математика",
  learning_goal: null,
  private_note: "Любит задачи",
  status: "active",
  created_at: "2026-11-01T10:00:00Z",
  updated_at: "2026-11-02T10:00:00Z",
  version: 3,
};

const card: TeacherCard = {
  id: "c1",
  name: "Маша",
  subject: "Математика",
  goal: null,
  note: "Любит задачи",
  hasStudentAccount: false,
  status: "active",
  createdAt: "2026-11-01T10:00:00Z",
  updatedAt: "2026-11-02T10:00:00Z",
  version: 3,
};

beforeEach(() => {
  clearApiContext();
  calls = [];
  responses = [json({ csrf_token: "t" })];
  vi.stubGlobal("window", { location: { origin: "https://tutorflow.test" } });
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, method: init.method ?? "GET", body: init.body ? JSON.parse(String(init.body)) : undefined });
    const next = responses.shift();
    if (!next) throw new TypeError("network");
    return next;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("studentsApi", () => {
  it("список карточек переводится в поля интерфейса", async () => {
    responses = [json({ items: [cardView], next_cursor: null })];
    await expect(studentsApi.cards("active")).resolves.toEqual([card]);
    expect(calls[0]?.url).toBe("/api/v1/teacher/student-cards?limit=100&status=active");
  });

  it("приглашение возвращает ссылку с секретом во фрагменте", async () => {
    responses.push(json({ invitation: { invitation_id: "i1", purpose: "new_student_card_for_parent", status: "pending", created_at: "x", expires_at: "y" }, invitation_token: "s/e+c" }, 201));
    const result = await studentsApi.invite("new_student_card_for_parent");
    expect(calls[1]).toMatchObject({ url: "/api/v1/teacher/invitations", method: "POST", body: { purpose: "new_student_card_for_parent" } });
    expect(result.url).toBe("https://tutorflow.test/invite#token=s%2Fe%2Bc");
    expect(tokenFromHash(new URL(result.url).hash)).toBe("s/e+c");
  });

  it("архив передаёт ожидаемую версию", async () => {
    responses.push(json({ ...cardView, status: "archived", version: 4 }));
    const archived = await studentsApi.archive(card);
    expect(calls[1]).toMatchObject({ url: "/api/v1/teacher/student-cards/c1/archive", body: { expected_version: 3 } });
    expect(archived).toMatchObject({ status: "archived", version: 4 });
  });

  it("правка без изменений не уходит на сервер", async () => {
    await expect(studentsApi.edit(card, { name: " Маша ", subject: "Математика" })).resolves.toBe(card);
    expect(calls).toHaveLength(0);
  });

  it("имя ребёнка передаётся только для родительской ссылки", async () => {
    responses.push(json({ purpose: "new_student_card_for_student", student_card_id: "c9" }, 201));
    await expect(studentsApi.accept("tok")).resolves.toEqual({ role: "student", cardId: "c9" });
    expect(calls[1]?.body).toEqual({ invitation_token: "tok" });
    responses.push(json({ purpose: "new_student_card_for_parent", student_card_id: "c8", parent_access_id: "p1" }, 201));
    await expect(studentsApi.accept("tok", " Петя ")).resolves.toEqual({ role: "parent", cardId: "c8" });
    expect(calls[2]?.body).toEqual({ invitation_token: "tok", student_card_name: "Петя" });
  });
});

describe("editBody", () => {
  it("берёт только изменённые поля, пустое необязательное поле очищает", () => {
    expect(editBody(card, { name: "Мария", subject: "  ", goal: "ОГЭ", note: "Любит задачи" })).toEqual({
      student_card_name: "Мария",
      subject: null,
      learning_goal: "ОГЭ",
      expected_version: 3,
    });
    expect(editBody(card, { note: "" })).toEqual({ private_note: null, expected_version: 3 });
  });
});

describe("studentsErrorCode", () => {
  it("переводит стабильные коды сервера", () => {
    expect(studentsErrorCode(new ApiError(400, "invitation_unavailable"))).toBe("invitationUnavailable");
    expect(studentsErrorCode(new ApiError(409, "student_card_has_open_lessons"))).toBe("openLessons");
    expect(studentsErrorCode(new ApiError(409, "version_conflict"))).toBe("versionConflict");
    expect(studentsErrorCode(new ApiError(429, "rate_limited"))).toBe("tooManyRequests");
    expect(studentsErrorCode(new Error("x"))).toBe("unavailable");
  });
});

describe("tokenFromHash", () => {
  it("без секрета — null", () => {
    expect(tokenFromHash("")).toBeNull();
    expect(tokenFromHash("#token=")).toBeNull();
  });
});
