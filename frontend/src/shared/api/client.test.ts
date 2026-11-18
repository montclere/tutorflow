import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearApiContext, describeError, request, requestAll } from "./client";

type Call = { url: string; init: RequestInit };

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", ...headers } });
}

function problem(status: number, code: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify({ status, code, title: "Заголовок", detail: "Подробности", ...extra }), {
    status,
    headers: { "Content-Type": "application/problem+json; charset=utf-8", ...headers },
  });
}

let calls: Call[];
let responses: Response[];

beforeEach(() => {
  clearApiContext();
  calls = [];
  responses = [];
  vi.stubGlobal("fetch", async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const next = responses.shift();
    if (!next) throw new TypeError("network");
    return next;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("request", () => {
  it("GET идёт без CSRF, с cookie того же origin", async () => {
    responses.push(json({ ok: true }));
    await request("/me");
    expect(calls[0]?.url).toBe("/api/v1/me");
    expect(calls[0]?.init.credentials).toBe("same-origin");
    expect(new Headers(calls[0]?.init.headers).has("X-CSRF-Token")).toBe(false);
  });

  it("перед изменяющим запросом получает CSRF и передаёт его в заголовке", async () => {
    responses.push(json({ csrf_token: "t1" }), json({ id: 1 }, 201));
    await request("/teacher/invitations", "POST", { purpose: "x" });
    expect(calls[0]?.url).toBe("/api/v1/auth/csrf");
    const headers = new Headers(calls[1]?.init.headers);
    expect(headers.get("X-CSRF-Token")).toBe("t1");
    expect(headers.get("Content-Type")).toBe("application/json");
    expect(calls[1]?.init.body).toBe(JSON.stringify({ purpose: "x" }));
  });

  it("запоминает CSRF из ответа входа и не запрашивает его повторно", async () => {
    responses.push(json({ csrf_token: "t1" }), json({ account: {}, csrf_token: "t2" }), new Response(null, { status: 204 }));
    await request("/auth/login", "POST", {});
    await request("/auth/session", "DELETE");
    expect(calls).toHaveLength(3);
    expect(new Headers(calls[2]?.init.headers).get("X-CSRF-Token")).toBe("t2");
  });

  it("ответ 204 возвращает undefined", async () => {
    responses.push(json({ csrf_token: "t1" }), new Response(null, { status: 204 }));
    await expect(request("/auth/session", "DELETE")).resolves.toBeUndefined();
  });

  it("разбирает Problem Details: код, текст, поля и Retry-After", async () => {
    responses.push(problem(422, "validation_failed", { errors: [{ field: "password", code: "invalid_value" }, { bad: 1 }] }, { "Retry-After": "30" }));
    const error = await request("/x").catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 422, code: "validation_failed", message: "Заголовок. Подробности", fields: [{ field: "password", code: "invalid_value" }], retryAfter: 30 });
  });

  it("при отказе сессии сбрасывает CSRF: следующий изменяющий запрос получит новый", async () => {
    responses.push(json({ csrf_token: "t1" }), problem(403, "authentication_required"), json({ csrf_token: "t3" }), json({}));
    await request("/x", "POST", {}).catch(() => undefined);
    await request("/x", "POST", {});
    expect(calls[2]?.url).toBe("/api/v1/auth/csrf");
    expect(new Headers(calls[3]?.init.headers).get("X-CSRF-Token")).toBe("t3");
  });

  it("ошибка без Problem Details и сетевой сбой дают понятный текст", async () => {
    responses.push(new Response("oops", { status: 502 }));
    const server = await request("/x").catch((caught: unknown) => caught);
    expect(server).toMatchObject({ status: 502, code: "request_failed", message: "Сервис временно недоступен. Попробуйте позже." });
    const network = await request("/x").catch((caught: unknown) => caught);
    expect(network).toMatchObject({ status: 0, code: "network_failed" });
    expect(describeError(new Error("x"))).toBe("Не удалось связаться с TutorFlow. Попробуйте ещё раз.");
  });
});

describe("requestAll", () => {
  it("проходит все страницы по курсору", async () => {
    responses.push(json({ items: [1, 2], next_cursor: "c1" }), json({ items: [3], next_cursor: null }));
    await expect(requestAll<number>("/teacher/student-cards", { status: "active" })).resolves.toEqual([1, 2, 3]);
    expect(calls[0]?.url).toBe("/api/v1/teacher/student-cards?limit=100&status=active");
    expect(calls[1]?.url).toBe("/api/v1/teacher/student-cards?limit=100&status=active&cursor=c1");
  });
});
