import { describe, expect, it } from "vitest";
import type { ScheduleLesson, WorkHours } from "../mocks/types";
import { upcomingFreeWindows } from "./freeSlots";

const work: WorkHours = { start: "12:00", end: "20:00", minFreeWindowMin: 90 };

function lesson(date: string, start: string): ScheduleLesson {
  return { id: `${date}-${start}`, studentId: "s", date, start, durationMin: 60, type: "individual", recurring: true };
}

describe("upcomingFreeWindows", () => {
  const lessons = [lesson("2026-11-16", "14:00"), lesson("2026-11-17", "15:00"), lesson("2026-11-18", "13:00")];
  const dates = ["2026-11-16", "2026-11-17", "2026-11-18"];

  it("пропускает прошедшие дни", () => {
    const result = upcomingFreeWindows(lessons, dates, work, "2026-11-17", "12:00");
    expect(result.every((item) => item.date >= "2026-11-17")).toBe(true);
  });

  it("обрезает сегодняшние окна по текущему времени", () => {
    const result = upcomingFreeWindows(lessons, ["2026-11-17"], work, "2026-11-17", "19:00");
    expect(result).toEqual([]);
  });

  it("возвращает окна будущих дней целиком", () => {
    const result = upcomingFreeWindows(lessons, ["2026-11-18"], work, "2026-11-17", "14:35");
    expect(result).toEqual([{ date: "2026-11-18", window: { start: "14:00", end: "20:00" } }]);
  });
});
