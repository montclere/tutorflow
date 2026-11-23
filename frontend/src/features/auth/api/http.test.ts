import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, clearApiContext } from "../../../shared/api/client";
import { httpAuthApi, toAuthErrorCode } from "./http";

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("регистрация", () => {
  it("репетитор — entrypoint teacher без токена; по приглашению — invitation с токеном на обоих шагах", async () => {
    clearApiContext();
    const bodies: unknown[] = [];
    const responses = [json({ csrf_token: "t" }), json({ challenge_id: "a" }, 202), json({ challenge_id: "b" }, 202), json({ account: {}, csrf_token: "t2" }, 201)];
    vi.stubGlobal("fetch", async (_url: string, init: RequestInit) => {
      if (init.body) bodies.push(JSON.parse(String(init.body)));
      return responses.shift();
    });
    const contact = { type: "email", value: "a@b.ru" } as const;
    await httpAuthApi.startRegistration(contact);
    await httpAuthApi.startRegistration(contact, "tok");
    await httpAuthApi.completeRegistration({ challengeId: "b", code: "12345678", password: "p", displayName: "Илья", timezone: "UTC", invitationToken: "tok" });
    expect(bodies[0]).toEqual({ login_contact: contact, entrypoint: "teacher" });
    expect(bodies[1]).toEqual({ login_contact: contact, entrypoint: "invitation", invitation_token: "tok" });
    expect(bodies[2]).toMatchObject({ challenge_id: "b", invitation_token: "tok" });
  });
});

describe("toAuthErrorCode", () => {
  it("переводит стабильные коды сервера", () => {
    expect(toAuthErrorCode(new ApiError(400, "challenge_invalid"))).toBe("invalidCode");
    expect(toAuthErrorCode(new ApiError(403, "invalid_credentials"))).toBe("invalidCredentials");
    expect(toAuthErrorCode(new ApiError(403, "authentication_required"))).toBe("unauthenticated");
  });

  it("лимит, сбой сервера и сети — свои коды", () => {
    expect(toAuthErrorCode(new ApiError(429, "rate_limited"))).toBe("tooManyRequests");
    expect(toAuthErrorCode(new ApiError(503, "database_unavailable"))).toBe("unavailable");
    expect(toAuthErrorCode(new ApiError(0, "network_failed"))).toBe("unavailable");
  });

  it("ошибки полей: контакт, пароль, прочее", () => {
    expect(toAuthErrorCode(new ApiError(422, "validation_failed", undefined, [{ field: "login_contact", code: "invalid_value" }]))).toBe("invalidContact");
    expect(toAuthErrorCode(new ApiError(422, "validation_failed", undefined, [{ field: "password", code: "invalid_value" }]))).toBe("weakPassword");
    expect(toAuthErrorCode(new ApiError(422, "validation_failed", undefined, [{ field: "display_name", code: "required" }]))).toBe("validation");
  });

  it("неизвестное — unknown", () => {
    expect(toAuthErrorCode(new Error("x"))).toBe("unknown");
    expect(toAuthErrorCode(new ApiError(409, "conflict"))).toBe("unknown");
  });
});
