import { describe, expect, it } from "vitest";
import { formatRubles, formatSigned, formatTimer } from "./format";

describe("format", () => {
  it("форматирует рубли из копеек", () => {
    expect(formatRubles(450000)).toMatch(/^4\s500 ₽$/);
  });

  it("добавляет знак к сумме", () => {
    expect(formatSigned(-120000)).toMatch(/^−1\s200 ₽$/);
    expect(formatSigned(120000)).toMatch(/^\+1\s200 ₽$/);
    expect(formatSigned(0)).toBe("0 ₽");
  });

  it("форматирует таймер", () => {
    expect(formatTimer(235 * 60)).toBe("3:55:00");
    expect(formatTimer(61)).toBe("0:01:01");
    expect(formatTimer(-5)).toBe("0:00:00");
  });
});
