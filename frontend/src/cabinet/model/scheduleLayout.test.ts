import { describe, expect, it } from "vitest";
import type { ScheduleLesson, WorkHours } from "../mocks/types";
import { assignColumns, blockPosition, clipWindowsFrom, freeWindows, gridHours, nowOffsetHours } from "./scheduleLayout";

const work: WorkHours = { start: "12:00", end: "20:00", minFreeWindowMin: 90 };

function lesson(id: string, start: string, durationMin = 60): ScheduleLesson {
  return { id, studentId: "s", date: "2026-11-17", start, durationMin, type: "individual", recurring: true };
}

describe("blockPosition", () => {
  it("считает верх и высоту в часах от начала сетки", () => {
    expect(blockPosition("15:30", 90, "12:00")).toEqual({ topHours: 3.5, heightHours: 1.5 });
  });
});

describe("gridHours", () => {
  it("даёт отметки каждого часа рабочего времени", () => {
    const hours = gridHours(work);
    expect(hours[0]).toBe("12:00");
    expect(hours).toHaveLength(8);
    expect(hours.at(-1)).toBe("19:00");
  });
});

describe("nowOffsetHours", () => {
  it("возвращает смещение внутри рабочего времени", () => {
    expect(nowOffsetHours("14:30", work)).toBe(2.5);
  });

  it("возвращает null вне рабочего времени", () => {
    expect(nowOffsetHours("09:00", work)).toBeNull();
    expect(nowOffsetHours("21:00", work)).toBeNull();
  });
});

describe("assignColumns", () => {
  it("не делит колонки без пересечений", () => {
    const slots = assignColumns([lesson("a", "12:00"), lesson("b", "13:00")]);
    expect(slots.map((slot) => [slot.column, slot.columns])).toEqual([
      [0, 1],
      [0, 1],
    ]);
  });

  it("делит ширину между пересекающимися уроками", () => {
    const slots = assignColumns([lesson("a", "12:00", 90), lesson("b", "12:30")]);
    expect(slots.map((slot) => [slot.lesson.id, slot.column, slot.columns])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
    ]);
  });

  it("переиспользует освободившуюся колонку внутри одной группы", () => {
    const slots = assignColumns([lesson("a", "12:00", 60), lesson("b", "12:30", 120), lesson("c", "13:00", 60)]);
    expect(slots.map((slot) => [slot.lesson.id, slot.column, slot.columns])).toEqual([
      ["a", 0, 2],
      ["b", 1, 2],
      ["c", 0, 2],
    ]);
  });

  it("считает урок, начинающийся в момент окончания другого, непересекающимся", () => {
    const slots = assignColumns([lesson("a", "12:00"), lesson("b", "13:00")]);
    expect(slots.every((slot) => slot.columns === 1)).toBe(true);
  });
});

describe("freeWindows", () => {
  it("находит окна не короче минимального", () => {
    const windows = freeWindows([lesson("a", "13:00"), lesson("b", "16:00")], work);
    expect(windows).toEqual([
      { start: "14:00", end: "16:00" },
      { start: "17:00", end: "20:00" },
    ]);
  });

  it("не считает короткие промежутки окнами", () => {
    expect(freeWindows([lesson("a", "12:00"), lesson("b", "13:00"), lesson("c", "14:30")], work)).toEqual([{ start: "15:30", end: "20:00" }]);
  });

  it("весь рабочий день свободен без уроков", () => {
    expect(freeWindows([], work)).toEqual([{ start: "12:00", end: "20:00" }]);
  });

  it("учитывает урок, выходящий за границу рабочего дня", () => {
    expect(freeWindows([lesson("a", "19:30")], work)).toEqual([{ start: "12:00", end: "19:30" }]);
  });
});

describe("clipWindowsFrom", () => {
  const windows = [
    { start: "13:00", end: "15:00" },
    { start: "17:00", end: "20:00" },
  ];

  it("обрезает окна по текущему времени и убирает слишком короткие", () => {
    expect(clipWindowsFrom(windows, "14:35", 90)).toEqual([{ start: "17:00", end: "20:00" }]);
  });

  it("не трогает окна позже текущего времени", () => {
    expect(clipWindowsFrom(windows, "12:00", 90)).toEqual(windows);
  });
});
