import { describe, expect, it } from "vitest";
import { formatInstant, formatInstantDate } from "./instant";

describe("formatInstant", () => {
  it("показывает момент в поясе профиля", () => {
    expect(formatInstantDate("2026-11-30T20:30:00Z", "Asia/Novosibirsk")).toBe("1 декабря");
    expect(formatInstant("2026-11-30T20:30:00Z", "Europe/Moscow")).toBe("30 ноября в 23:30");
  });
});
