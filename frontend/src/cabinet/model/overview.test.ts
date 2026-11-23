import { describe, expect, it } from "vitest";
import type { AttentionItem, ScheduleLesson, Student } from "../mocks/types";
import { mainAttention, attentionDestination, lessonMark, toLessonRow, weekDays } from "./overview";

const student = { id: "s", goal: "ОГЭ · цель 5", balance: 0, payment: { model: "per_lesson", pricePerLesson: 100000 } } as Student;
const debtor = { ...student, balance: -100 } as Student;

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

  it("отдаёт дату каждого дня, чтобы столбец вёл в расписание", () => {
    const days = weekDays([], "2026-11-17", ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]);
    expect(days[0]?.date).toBe("2026-11-16");
    expect(days[6]?.date).toBe("2026-11-22");
  });
});

describe("lessonMark", () => {
  const past = toLessonRow(lesson("2026-11-17", "12:00"), student, "2026-11-17", "14:35");
  const future = toLessonRow(lesson("2026-11-17", "18:00"), student, "2026-11-17", "14:35");

  it("прошедший урок ждёт отметки, пока его не отметили", () => {
    expect(lessonMark(past, [])).toBe("toMark");
    expect(lessonMark(past, [past.id])).toBe("marked");
  });

  it("будущий урок отмечать нельзя", () => {
    expect(lessonMark(future, [])).toBe("none");
    expect(lessonMark(future, [future.id])).toBe("none");
  });
});

describe("attentionDestination", () => {
  it("работы на проверку ведут в «Проверку»", () => {
    expect(attentionDestination({ kind: "review", title: "", note: "" })).toEqual({ to: "review" });
  });

  it("долг, пакет и неактивность ведут в карточку ученика", () => {
    for (const kind of ["debt", "package", "inactive"] as const) {
      expect(attentionDestination({ kind, title: "", note: "", studentId: "petrov" })).toEqual({ to: "student", studentId: "petrov" });
    }
  });

  it("неотмеченный урок отмечается на месте", () => {
    expect(attentionDestination({ kind: "lesson", title: "", note: "" })).toEqual({ to: "markLesson" });
  });

  it("без ученика вести некуда", () => {
    expect(attentionDestination({ kind: "debt", title: "", note: "" })).toBeNull();
  });
});


describe("mainAttention — MAIN-2", () => {
  const items: AttentionItem[] = [
    { kind: "debt", title: "Долг", note: "" },
    { kind: "lesson", title: "Урок", note: "" },
    { kind: "review", title: "Проверка", note: "" },
    { kind: "package", title: "Пакет", note: "" },
    { kind: "inactive", title: "Активность", note: "" },
  ];
  it("исключает задолженность до лимита, сохраняя полезные действия", () => {
    expect(mainAttention(items, [], 4).map(item => item.kind)).toEqual(["lesson", "review", "package", "inactive"]);
    expect(items).toHaveLength(5);
  });
  it("учитывает скрытые элементы в видимом количестве", () => {
    expect(mainAttention(items, ["lesson", "review"], 4).map(item => item.kind)).toEqual(["package", "inactive"]);
    expect(mainAttention(items, ["lesson", "review", "package", "inactive"], 4)).toEqual([]);
  });
  it("не показывает пустой список и только задолженность как действия", () => {
    expect(mainAttention([], [], 4)).toEqual([]);
    expect(mainAttention(items.slice(0, 1), [], 4)).toEqual([]);
  });
});
