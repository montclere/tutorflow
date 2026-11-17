import { describe, expect, it } from "vitest";
import { formatLessons, formatPackage, formatRubles, formatSigned, formatTimer, formatTimesPerWeek } from "./format";

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

describe("склонения и подписи", () => {
  it("склоняет уроки", () => {
    expect(formatLessons(1)).toBe("1 урок");
    expect(formatLessons(3)).toBe("3 урока");
    expect(formatLessons(5)).toBe("5 уроков");
    expect(formatLessons(11)).toBe("11 уроков");
  });

  it("пишет «раз в неделю» с правильной формой", () => {
    expect(formatTimesPerWeek(1)).toBe("1 раз в неделю");
    expect(formatTimesPerWeek(2)).toBe("2 раза в неделю");
    expect(formatTimesPerWeek(5)).toBe("5 раз в неделю");
  });

  it("описывает абонемент", () => {
    expect(formatPackage(8, 125000, 1)).toMatch(/^8 × 1\s250 ₽ · осталось 1$/);
  });
});
