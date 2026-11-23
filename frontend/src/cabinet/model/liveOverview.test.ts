import { describe, expect, it } from "vitest";
import type { ScheduleLesson } from "../mocks/types";
import { liveOverview, overviewRange } from "./liveOverview";

const lesson = (id: string, date: string, start: string, status: ScheduleLesson["status"] = "scheduled"): ScheduleLesson => ({
  id,
  studentId: "c",
  date,
  start,
  durationMin: 60,
  type: "individual",
  recurring: false,
  status,
});

describe("liveOverview", () => {
  const lessons = [
    lesson("past-unmarked", "2026-11-18", "17:00"),
    lesson("done", "2026-11-18", "10:00", "completed"),
    lesson("ended-today", "2026-11-19", "09:00"),
    lesson("later-today", "2026-11-19", "18:00"),
    lesson("cancelled-today", "2026-11-19", "19:00", "cancelled"),
    lesson("tomorrow", "2026-11-20", "16:00"),
  ];

  it("сегодня — только предстоящие, отменённые не в списке; завтра — отдельно", () => {
    const view = liveOverview(lessons, "2026-11-19", "12:00");
    expect(view.today.map((item) => item.id)).toEqual(["later-today"]);
    expect(view.tomorrow.map((item) => item.id)).toEqual(["tomorrow"]);
  });

  it("неотмеченные прошедшие — новые сверху", () => {
    expect(liveOverview(lessons, "2026-11-19", "12:00").toMark.map((item) => item.id)).toEqual(["ended-today", "past-unmarked"]);
  });

  it("итоги недели по состояниям", () => {
    expect(liveOverview(lessons, "2026-11-19", "12:00").week).toEqual({ planned: 4, completed: 1, noShow: 0, cancelled: 1 });
  });

  it("окно: две недели назад и не меньше конца текущей недели", () => {
    expect(overviewRange("2026-11-19")).toEqual({ from: "2026-11-05", to: "2026-11-26" });
  });
});
