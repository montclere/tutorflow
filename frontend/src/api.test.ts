import { afterEach, expect, test, vi } from "vitest";

import { api, ApiError, message } from "./api";

afterEach(() => vi.unstubAllGlobals());

test("читает машинный код RFC 9457 и показывает ID серверной ошибки", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          type: "urn:tutorflow:problem:internal_error",
          title: "Internal Server Error",
          status: 500,
          detail: "Не удалось выполнить операцию.",
          code: "internal_error",
          request_id: "a0725cd8-5a6f-4bcb-b1ea-1833bd168d3d",
        }),
        {
          status: 500,
          headers: {
            "content-type": "application/problem+json",
            "x-request-id": "a0725cd8-5a6f-4bcb-b1ea-1833bd168d3d",
          },
        },
      ),
    ),
  );

  const error: unknown = await api.me().catch((failure: unknown) => failure);
  expect(error).toBeInstanceOf(ApiError);
  expect(message(error)).toContain("a0725cd8-5a6f-4bcb-b1ea-1833bd168d3d");
});

test("описывает отказ входа по стабильному коду", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: "invalid_credentials",
          detail: "Произвольный текст сервера",
        }),
        { status: 401 },
      ),
    ),
  );

  const error: unknown = await api.me().catch((failure: unknown) => failure);
  expect(message(error)).toBe("Неверный контакт или пароль.");
});

test("вход преподавателя явно проверяет свой кабинет", async () => {
  const fetch = vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(new Response(JSON.stringify({ id: "account", roles: ["teacher"] }))),
    );
  vi.stubGlobal("fetch", fetch);

  await api.me();
  expect(fetch.mock.calls[0][0]).toBe("/api/v1/me?role=teacher");

  await api.login({ type: "email", value: "teacher@example.com" }, "password");
  const body = JSON.parse(fetch.mock.calls[1][1].body);
  expect(body.role).toBe("teacher");
});
