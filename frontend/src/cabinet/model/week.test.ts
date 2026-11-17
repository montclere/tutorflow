import { describe, expect, it } from "vitest";
import type { WeekDay } from "../mocks/types";
import { barHeightPercent, freeWindowsText, weekLoadPercent, weekTotal } from "./week";

const days: WeekDay[] = [
  { label: "Пн", lessons: 3 },
  { label: "Вт", lessons: 5, today: true },
  { label: "Ср", lessons: 0 },
];

describe("week", () => {
  it("считает уроки за неделю", () => {
    expect(weekTotal(days)).toBe(8);
  });

  it("считает загрузку в процентах", () => {
    expect(weekLoadPercent(days, 16)).toBe(50);
    expect(weekLoadPercent(days, 0)).toBe(0);
  });

  it("масштабирует столбики по максимуму", () => {
    expect(barHeightPercent(5, days)).toBe(100);
    expect(barHeightPercent(3, days)).toBe(60);
    expect(barHeightPercent(0, [{ label: "Пн", lessons: 0 }])).toBe(0);
  });

  it("собирает текст со свободными окнами", () => {
    expect(freeWindowsText("Окна:", ["Ср 14:00–17:00", "Чт 17:00–19:00"])).toBe("Окна:\nСр 14:00–17:00\nЧт 17:00–19:00");
  });
});
