import { describe, expect, it } from "vitest";
import { parseDateParam, parseView, periodTitle, stepDate, viewRange } from "./scheduleRange";

describe("viewRange", () => {
  it("день — одна дата", () => {
    expect(viewRange("day", "2026-11-17")).toEqual({ from: "2026-11-17", to: "2026-11-17" });
  });

  it("неделя идёт с понедельника по воскресенье", () => {
    expect(viewRange("week", "2026-11-18")).toEqual({ from: "2026-11-16", to: "2026-11-22" });
  });

  it("месяц охватывает все дни месяца", () => {
    expect(viewRange("month", "2026-11-17")).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("список — две недели вперёд", () => {
    expect(viewRange("list", "2026-11-17")).toEqual({ from: "2026-11-17", to: "2026-11-30" });
  });
});

describe("stepDate", () => {
  it("сдвигает дату по шагу вида", () => {
    expect(stepDate("day", "2026-11-17", 1)).toBe("2026-11-18");
    expect(stepDate("week", "2026-11-17", -1)).toBe("2026-11-10");
    expect(stepDate("month", "2026-11-17", 1)).toBe("2026-12-01");
    expect(stepDate("list", "2026-11-17", 1)).toBe("2026-12-01");
  });
});

describe("periodTitle", () => {
  it("даёт заголовок для каждого вида", () => {
    expect(periodTitle("day", "2026-11-17")).toBe("Вторник, 17 ноября");
    expect(periodTitle("week", "2026-11-17")).toBe("16 — 22 ноября");
    expect(periodTitle("month", "2026-11-17")).toBe("Ноябрь 2026");
  });
});

describe("параметры адреса", () => {
  it("принимает только известные виды", () => {
    expect(parseView("month", "week")).toBe("month");
    expect(parseView("year", "week")).toBe("week");
    expect(parseView(null, "list")).toBe("list");
  });

  it("принимает только дату в формате ISO", () => {
    expect(parseDateParam("2026-11-20", "2026-11-17")).toBe("2026-11-20");
    expect(parseDateParam("20.11.2026", "2026-11-17")).toBe("2026-11-17");
    expect(parseDateParam(null, "2026-11-17")).toBe("2026-11-17");
  });
});
