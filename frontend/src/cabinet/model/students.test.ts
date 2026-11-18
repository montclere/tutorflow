import { describe, expect, it } from "vitest";
import type { LessonTemplate, ScheduleLesson, Student } from "../mocks/types";
import { countByStatus, deriveSchedule, filterStudents, formatNextLesson, nextLessonOf, paymentStatus, templatesFromLessons } from "./students";

function student(partial: Partial<Student>): Student {
  return { id: "s", name: "Анна Мельник", status: "active", balance: 0, payment: { model: "per_lesson", pricePerLesson: 100000 }, ...partial } as Student;
}

describe("paymentStatus", () => {
  it("долг при отрицательном балансе", () => {
    expect(paymentStatus(student({ balance: -100 }))).toBe("debt");
  });

  it("мало уроков в абонементе", () => {
    expect(paymentStatus(student({ payment: { model: "package", pricePerLesson: 1, package: { lessons: 8, price: 1, left: 1 } } }))).toBe("low");
  });

  it("оплачено в остальных случаях", () => {
    expect(paymentStatus(student({ balance: 500 }))).toBe("paid");
    expect(paymentStatus(student({ payment: { model: "package", pricePerLesson: 1, package: { lessons: 8, price: 1, left: 4 } } }))).toBe("paid");
  });
});

describe("filterStudents", () => {
  const list = [
    student({ id: "a", name: "Анна Мельник", status: "active", balance: -1 }),
    student({ id: "b", name: "Борис Орлов", status: "active", balance: 0 }),
    student({ id: "c", name: "Вера Орлова", status: "pause" }),
  ];

  it("фильтрует по статусу", () => {
    expect(filterStudents(list, { status: "active", query: "", debtorsOnly: false }).map((item) => item.id)).toEqual(["a", "b"]);
  });

  it("ищет по имени без учёта регистра и пробелов по краям", () => {
    expect(filterStudents(list, { status: "active", query: "  ОРЛ ", debtorsOnly: false }).map((item) => item.id)).toEqual(["b"]);
  });

  it("оставляет только должников", () => {
    expect(filterStudents(list, { status: "active", query: "", debtorsOnly: true }).map((item) => item.id)).toEqual(["a"]);
  });

  it("считает учеников по статусам", () => {
    expect(countByStatus(list)).toEqual({ active: 2, pause: 1, archive: 0 });
  });
});

describe("deriveSchedule", () => {
  const templates: LessonTemplate[] = [
    { id: "1", studentId: "a", weekday: 3, start: "16:00", durationMin: 60, type: "individual" },
    { id: "2", studentId: "a", weekday: 1, start: "16:00", durationMin: 60, type: "individual" },
    { id: "3", studentId: "b", weekday: 0, start: "12:00", durationMin: 60, type: "individual" },
    { id: "4", studentId: "b", weekday: 4, start: "13:00", durationMin: 60, type: "individual" },
  ];
  const labels = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  it("собирает дни по порядку недели и общее время", () => {
    expect(deriveSchedule("a", templates, labels, "в разное время")).toEqual({ timesPerWeek: 2, days: ["Вт", "Чт"], time: "16:00", durationMin: 60 });
  });

  it("подписывает разное время", () => {
    expect(deriveSchedule("b", templates, labels, "в разное время").time).toBe("в разное время");
  });

  it("возвращает пустое расписание без уроков", () => {
    expect(deriveSchedule("z", templates, labels, "x")).toEqual({ timesPerWeek: 0, days: [], time: "", durationMin: 0 });
  });
});

describe("nextLesson", () => {
  const lessons: ScheduleLesson[] = [
    { id: "1", studentId: "a", date: "2026-11-17", start: "12:00", durationMin: 60, type: "individual", recurring: true },
    { id: "2", studentId: "a", date: "2026-11-19", start: "16:00", durationMin: 60, type: "individual", recurring: true },
    { id: "3", studentId: "b", date: "2026-11-17", start: "15:00", durationMin: 60, type: "individual", recurring: true },
  ];
  const labels = { today: "Сегодня", tomorrow: "Завтра", weekdays: ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"] };

  it("находит ближайший непройденный урок ученика", () => {
    expect(nextLessonOf("a", lessons, "2026-11-17", "14:35")).toEqual({ date: "2026-11-19", start: "16:00" });
    expect(nextLessonOf("z", lessons, "2026-11-17", "14:35")).toBeNull();
  });

  it("подписывает ближайший урок", () => {
    expect(formatNextLesson({ date: "2026-11-17", start: "15:00" }, "2026-11-17", labels)).toBe("Сегодня 15:00");
    expect(formatNextLesson({ date: "2026-11-18", start: "13:00" }, "2026-11-17", labels)).toBe("Завтра 13:00");
    expect(formatNextLesson({ date: "2026-11-19", start: "16:00" }, "2026-11-17", labels)).toBe("Чт 16:00");
    expect(formatNextLesson({ date: "2026-11-26", start: "16:00" }, "2026-11-17", labels)).toBe("Чт 26.11 16:00");
  });
});

describe("templatesFromLessons", () => {
  const lesson = (date: string, start: string, recurring = true, type: "individual" | "trial" = "individual") =>
    ({ id: `${date}-${start}`, studentId: "s", date, start, durationMin: 60, type, recurring }) as const;

  it("берёт регулярные уроки ученика на ближайшую неделю, по одному на день недели", () => {
    const templates = templatesFromLessons(
      "s",
      [lesson("2026-11-18", "16:30"), lesson("2026-11-20", "17:00"), lesson("2026-11-25", "16:30"), lesson("2026-11-19", "12:00", false), lesson("2026-11-21", "12:00", true, "trial")],
      "2026-11-17",
    );
    expect(templates.map((item) => [item.weekday, item.start])).toEqual([
      [2, "16:30"],
      [4, "17:00"],
    ]);
  });
});
