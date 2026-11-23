import { describe, expect, it } from "vitest";
import type { CabinetLesson } from "../cabinet/api/lessonRequests";
import { familyState, mondayOf } from "./LearnerSchedule";

describe("расписание ученика и родителя", () => {
  it("неделя начинается с понедельника", () => {
    expect(mondayOf("2026-11-19")).toBe("2026-11-16");
    expect(mondayOf("2026-11-22")).toBe("2026-11-16");
    expect(mondayOf("2026-11-16")).toBe("2026-11-16");
  });

  it("запланированный урок после окончания — «Отметки пока нет», как у бэкенда", () => {
    const lesson = { status: "scheduled", endsAt: "2026-11-16T11:00:00Z" } as CabinetLesson;
    expect(familyState(lesson, Date.parse("2026-11-16T12:00:00Z"))).toBe("Отметки пока нет");
    expect(familyState(lesson, Date.parse("2026-11-16T10:30:00Z"))).toBe("Запланирован");
    expect(familyState({ ...lesson, status: "no_show" }, Date.parse("2026-11-16T12:00:00Z"))).toBe("Пропущен");
  });
});
