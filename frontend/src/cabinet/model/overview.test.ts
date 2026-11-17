import { describe, expect, it } from "vitest";
import type { ScheduleLesson, Student } from "../mocks/types";
import { toLessonRow, weekDays } from "./overview";

const student = { id: "s", subject: "Математика · ОГЭ", payment: "paid" } as Student;
const debtor = { ...student, payment: "debt" } as Student;

function lesson(date: string, start: string): ScheduleLesson {
  return { id: `${date}-${start}`, studentId: "s", date, start, durationMin: 60, type: "individual", recurring: true };
}

describe("toLessonRow", () => {
  it("помечает прошедший урок проведённым", () => {
    expect(toLessonRow(lesson("2026-11-17", "12:00"), student, "2026-11-17", "14:35").status).toBe("done");
  });

  it("помечает урок в ближайший час как скорый", () => {
    const row = toLessonRow(lesson("2026-11-17", "15:00"), student, "2026-11-17", "14:35");
    expect(row.status).toBe("soon");
    expect(row.minutes).toBe(25);
  });

  it("показывает оплату и долг для будущих уроков", () => {
    expect(toLessonRow(lesson("2026-11-17", "18:00"), student, "2026-11-17", "14:35").status).toBe("paid");
    expect(toLessonRow(lesson("2026-11-17", "18:00"), debtor, "2026-11-17", "14:35").status).toBe("debt");
  });
});

describe("weekDays", () => {
  it("считает уроки по дням недели и отмечает сегодня", () => {
    const days = weekDays([lesson("2026-11-16", "12:00"), lesson("2026-11-17", "12:00"), lesson("2026-11-17", "14:00")], "2026-11-17", ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]);
    expect(days.map((day) => day.lessons)).toEqual([1, 2, 0, 0, 0, 0, 0]);
    expect(days[1]?.today).toBe(true);
    expect(days[0]?.today).toBe(false);
  });
});
