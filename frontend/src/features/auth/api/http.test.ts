import { describe, expect, it } from "vitest";
import { ApiError } from "../../../shared/api/client";
import { toAuthErrorCode } from "./http";

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
