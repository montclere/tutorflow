import { describe, expect, it } from "vitest";
import { addDays, addMonths, daysBetween, formatLongDay, formatMonthTitle, formatRange, monthGrid, startOfWeek, weekDates, weekdayIndex } from "./dates";

describe("dates", () => {
  it("находит день недели с понедельника", () => {
    expect(weekdayIndex("2026-11-16")).toBe(0);
    expect(weekdayIndex("2026-11-22")).toBe(6);
  });

  it("находит начало недели", () => {
    expect(startOfWeek("2026-11-17")).toBe("2026-11-16");
    expect(startOfWeek("2026-11-22")).toBe("2026-11-16");
  });

  it("переходит между месяцами при сложении дней", () => {
    expect(addDays("2026-11-30", 1)).toBe("2026-12-01");
    expect(addDays("2026-11-01", -1)).toBe("2026-10-31");
  });

  it("считает дни между датами", () => {
    expect(daysBetween("2026-11-16", "2026-11-22")).toBe(6);
  });

  it("строит неделю без выходных и с ними", () => {
    expect(weekDates("2026-11-18", false)).toEqual(["2026-11-16", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"]);
    expect(weekDates("2026-11-18", true)).toHaveLength(7);
  });

  it("строит сетку месяца с неполными неделями по краям", () => {
    const grid = monthGrid("2026-11-17");
    expect(grid[0]?.[0]).toBe("2026-10-26");
    expect(grid[0]?.[6]).toBe("2026-11-01");
    expect(grid).toHaveLength(6);
    expect(grid.at(-1)?.[0]).toBe("2026-11-30");
    expect(grid.at(-1)?.[6]).toBe("2026-12-06");
    expect(grid.every((week) => week.length === 7)).toBe(true);
  });

  it("сдвигает месяц на первое число", () => {
    expect(addMonths("2026-11-17", 1)).toBe("2026-12-01");
    expect(addMonths("2026-01-31", -1)).toBe("2025-12-01");
  });

  it("форматирует заголовки периода", () => {
    expect(formatRange("2026-11-16", "2026-11-20")).toBe("16 — 20 ноября");
    expect(formatRange("2026-11-30", "2026-12-04")).toBe("30 ноября — 4 декабря");
    expect(formatMonthTitle("2026-11-17")).toBe("Ноябрь 2026");
    expect(formatLongDay("2026-11-17")).toBe("Вторник, 17 ноября");
  });
});
