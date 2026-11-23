import { describe, expect, it } from "vitest";
import type { LessonTemplate, ScheduleLesson } from "../mocks/types";
import { expandTemplates, filterLessons, groupByDate, isPast, lessonPhase, lessonsOn, minutesUntil, nextLesson } from "./lessons";

const templates: LessonTemplate[] = [
  { id: "t1", studentId: "a", weekday: 1, start: "15:00", durationMin: 60, type: "individual" },
  { id: "t2", studentId: "b", weekday: 5, start: "12:00", durationMin: 60, type: "group" },
];

describe("expandTemplates", () => {
  const lessons = expandTemplates(templates, "2026-11-16", "2026-11-29");

  it("раскладывает шаблоны по дням недели", () => {
    expect(lessons.map((lesson) => lesson.date)).toEqual(["2026-11-17", "2026-11-21", "2026-11-24", "2026-11-28"]);
  });

  it("помечает все уроки по шаблону регулярными", () => {
    expect(lessons.every((lesson) => lesson.recurring)).toBe(true);
  });
});

describe("lessons helpers", () => {
  const lessons = expandTemplates(templates, "2026-11-16", "2026-11-29");

  it("выбирает уроки дня", () => {
    expect(lessonsOn(lessons, "2026-11-17")).toHaveLength(1);
  });

  it("фильтрует по ученику и типу", () => {
    expect(filterLessons(lessons, { studentId: "a", type: null })).toHaveLength(2);
    expect(filterLessons(lessons, { studentId: null, type: "group" })).toHaveLength(2);
    expect(filterLessons(lessons, { studentId: "a", type: "group" })).toHaveLength(0);
  });

  it("определяет прошедшие уроки", () => {
    const [first] = lessons as [ScheduleLesson];
    expect(isPast(first, "2026-11-17", "16:00")).toBe(true);
    expect(isPast(first, "2026-11-17", "15:30")).toBe(false);
    expect(isPast(first, "2026-11-18", "09:00")).toBe(true);
    expect(isPast(first, "2026-11-16", "09:00")).toBe(false);
  });

  it("находит ближайший непройденный урок", () => {
    expect(nextLesson(lessons, "2026-11-17", "14:35")?.id).toBe("t1-2026-11-17");
    expect(nextLesson(lessons, "2026-11-17", "16:00")?.id).toBe("t2-2026-11-21");
  });

  it("считает минуты до начала урока", () => {
    const [first] = lessons as [ScheduleLesson];
    expect(minutesUntil(first, "2026-11-17", "14:35")).toBe(25);
  });

  it("группирует уроки по датам", () => {
    expect(groupByDate(lessons).map((group) => [group.date, group.lessons.length])).toEqual([
      ["2026-11-17", 1],
      ["2026-11-21", 1],
      ["2026-11-24", 1],
      ["2026-11-28", 1],
    ]);
  });
});

describe("lessonPhase", () => {
  const base: ScheduleLesson = { id: "x", studentId: "s", date: "2026-11-17", start: "15:00", durationMin: 60, type: "individual", recurring: false };

  it("до начала — впереди, во время — идёт, после конца — прошёл", () => {
    expect(lessonPhase(base, "2026-11-17", "14:35")).toBe("upcoming");
    expect(lessonPhase(base, "2026-11-17", "15:20")).toBe("live");
    expect(lessonPhase(base, "2026-11-17", "16:00")).toBe("ended");
  });

  it("учитывает другие дни", () => {
    expect(lessonPhase({ ...base, date: "2026-11-18" }, "2026-11-17", "23:00")).toBe("upcoming");
    expect(lessonPhase({ ...base, date: "2026-11-16" }, "2026-11-17", "08:00")).toBe("ended");
  });
});
