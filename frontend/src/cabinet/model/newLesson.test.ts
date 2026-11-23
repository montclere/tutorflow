import { describe, expect, it } from "vitest";
import type { ScheduleLesson, WorkHours } from "../mocks/types";
import {
  buildLessons,
  defaultStart,
  draftDates,
  draftErrors,
  findConflicts,
  schoolYearEnd,
  timeAtOffset,
  timeInWindow,
  type LessonDraft,
} from "./newLesson";

const work: WorkHours = { start: "12:00", end: "20:00", minFreeWindowMin: 90 };

function draft(patch: Partial<LessonDraft> = {}): LessonDraft {
  return {
    studentId: "smirnova",
    date: "2026-11-18",
    start: "16:30",
    durationMin: 60,
    type: "individual",
    repeat: { kind: "none" },
    link: "",
    ...patch,
  };
}

function lesson(date: string, start: string, durationMin = 60): ScheduleLesson {
  return { id: `${date}-${start}`, studentId: "petrov", date, start, durationMin, type: "individual", recurring: false };
}

describe("draftDates", () => {
  it("без повтора — один день", () => {
    expect(draftDates(draft())).toEqual(["2026-11-18"]);
  });

  it("с повтором — выбранные дни недели до конечной даты включительно", () => {
    // 18.11 — среда (2), 20.11 — пятница (4).
    const dates = draftDates(draft({ repeat: { kind: "weekly", weekdays: [2, 4], until: "2026-11-27" } }));
    expect(dates).toEqual(["2026-11-18", "2026-11-20", "2026-11-25", "2026-11-27"]);
  });

  it("не начинает серию раньше выбранной даты", () => {
    // Понедельник 16.11 раньше начала — в серию не попадает.
    const dates = draftDates(draft({ repeat: { kind: "weekly", weekdays: [0], until: "2026-11-30" } }));
    expect(dates).toEqual(["2026-11-23", "2026-11-30"]);
  });
});

describe("buildLessons", () => {
  it("создаёт уроки с учеником, временем и пометкой регулярности", () => {
    const lessons = buildLessons(draft({ repeat: { kind: "weekly", weekdays: [2], until: "2026-11-25" } }), "new");
    expect(lessons).toHaveLength(2);
    expect(lessons[0]).toMatchObject({ id: "new-0", studentId: "smirnova", date: "2026-11-18", start: "16:30", durationMin: 60, recurring: true });
  });

  it("без ученика ничего не создаёт", () => {
    expect(buildLessons(draft({ studentId: null }), "new")).toEqual([]);
  });

  it("сохраняет ссылку на встречу, если она задана", () => {
    expect(buildLessons(draft({ link: " https://meet.example/abc " }), "new")[0]?.link).toBe("https://meet.example/abc");
    expect(buildLessons(draft(), "new")[0]?.link).toBeUndefined();
  });
});

describe("findConflicts", () => {
  it("находит пересечения в тот же день", () => {
    const candidate = buildLessons(draft({ start: "16:30" }), "new");
    const conflicts = findConflicts(candidate, [lesson("2026-11-18", "17:00"), lesson("2026-11-18", "13:00"), lesson("2026-11-19", "16:30")]);
    expect(conflicts.map((item) => item.existing.start)).toEqual(["17:00"]);
  });

  it("урок встык не считается пересечением", () => {
    const candidate = buildLessons(draft({ start: "16:00" }), "new");
    expect(findConflicts(candidate, [lesson("2026-11-18", "17:00"), lesson("2026-11-18", "15:00")])).toEqual([]);
  });
});

describe("draftErrors", () => {
  const today = "2026-11-17";
  const now = "14:35";

  it("нормальный черновик без ошибок", () => {
    expect(draftErrors(draft(), today, now)).toEqual([]);
  });

  it("требует ученика", () => {
    expect(draftErrors(draft({ studentId: null }), today, now)).toContain("student");
  });

  it("не даёт поставить урок в прошлое", () => {
    expect(draftErrors(draft({ date: "2026-11-16" }), today, now)).toContain("past");
    expect(draftErrors(draft({ date: today, start: "14:00" }), today, now)).toContain("past");
    expect(draftErrors(draft({ date: today, start: "15:00" }), today, now)).not.toContain("past");
  });

  it("проверяет длительность и границы суток", () => {
    expect(draftErrors(draft({ durationMin: 10 }), today, now)).toContain("duration");
    expect(draftErrors(draft({ durationMin: 300 }), today, now)).toContain("duration");
    expect(draftErrors(draft({ start: "23:30", durationMin: 60 }), today, now)).toContain("outsideDay");
  });

  it("для повтора нужны дни недели и конечная дата не раньше начала", () => {
    expect(draftErrors(draft({ repeat: { kind: "weekly", weekdays: [], until: "2026-12-31" } }), today, now)).toContain("weekdays");
    expect(draftErrors(draft({ repeat: { kind: "weekly", weekdays: [2], until: "2026-11-10" } }), today, now)).toContain("until");
  });
});

describe("время", () => {
  it("по смещению клика в ячейке часа даёт время с шагом 15 минут", () => {
    expect(timeAtOffset("12:00", 2, 0)).toBe("14:00");
    expect(timeAtOffset("12:00", 2, 0.6)).toBe("14:30");
    expect(timeAtOffset("12:00", 2, 0.99)).toBe("14:45");
  });

  it("по клику внутри свободного окна даёт время с шагом 15 минут", () => {
    expect(timeInWindow("12:00", "16:00", 0)).toBe("12:00");
    expect(timeInWindow("12:00", "16:00", 0.4)).toBe("13:30");
    expect(timeInWindow("12:00", "16:00", 1)).toBe("15:45");
  });

  it("время по умолчанию: сегодня — ближайшее после «сейчас», другой день — начало рабочего дня", () => {
    expect(defaultStart(work, "2026-11-17", "2026-11-17", "14:35")).toBe("14:45");
    expect(defaultStart(work, "2026-11-18", "2026-11-17", "14:35")).toBe("12:00");
    expect(defaultStart(work, "2026-11-17", "2026-11-17", "09:10")).toBe("12:00");
  });

  it("конец учебного года — 31 мая ближайшего мая", () => {
    expect(schoolYearEnd("2026-11-18")).toBe("2027-05-31");
    expect(schoolYearEnd("2027-02-01")).toBe("2027-05-31");
    expect(schoolYearEnd("2027-07-01")).toBe("2028-05-31");
  });
});
