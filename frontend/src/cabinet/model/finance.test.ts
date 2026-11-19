import { describe, expect, it } from "vitest";
import type { FinanceOperation, ScheduleLesson } from "../mocks/types";
import { expectedIncome, filterOperations, growthPercent, incomeByStudent, lessonsAhead, methodOfTitle, monthIndex, monthKeyOf, shiftMonth } from "./finance";

describe("месяцы", () => {
  it("берёт ключ месяца из даты", () => {
    expect(monthKeyOf("2026-11-17")).toBe("2026-11");
  });

  it("сдвигает месяц через границу года", () => {
    expect(shiftMonth("2026-11", 1)).toBe("2026-12");
    expect(shiftMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftMonth("2026-01", -1)).toBe("2025-12");
  });

  it("даёт номер месяца с нуля", () => {
    expect(monthIndex("2026-11")).toBe(10);
  });
});

describe("growthPercent", () => {
  it("считает рост и падение в процентах", () => {
    expect(growthPercent(8_240_000, 7_357_000)).toBe(12);
    expect(growthPercent(90, 100)).toBe(-10);
  });

  it("не считает без прошлого месяца", () => {
    expect(growthPercent(100, 0)).toBeNull();
  });
});

describe("expectedIncome", () => {
  const lessons: ScheduleLesson[] = [
    { id: "1", studentId: "a", date: "2026-11-17", start: "12:00", durationMin: 60, type: "individual", recurring: true },
    { id: "2", studentId: "a", date: "2026-11-17", start: "18:00", durationMin: 60, type: "individual", recurring: true },
    { id: "3", studentId: "b", date: "2026-11-20", start: "12:00", durationMin: 60, type: "individual", recurring: true },
    { id: "4", studentId: "b", date: "2026-12-01", start: "12:00", durationMin: 60, type: "individual", recurring: true },
  ];
  const price = (id: string) => (id === "a" ? 100_000 : id === "b" ? 150_000 : null);

  it("суммирует предстоящие поурочные уроки месяца и добавляет долги", () => {
    expect(expectedIncome(lessons, price, "2026-11", "2026-11-17", "14:35", 120_000)).toEqual({ amount: 370_000, lessons: 2 });
  });

  it("не считает уроки из абонементов", () => {
    const withPackage: ScheduleLesson[] = [...lessons, { id: "5", studentId: "pack", date: "2026-11-25", start: "12:00", durationMin: 60, type: "individual", recurring: true }];
    expect(expectedIncome(withPackage, price, "2026-11", "2026-11-17", "14:35", 0)).toEqual({ amount: 250_000, lessons: 2 });
  });

  it("не добавляет долги к другим месяцам и не считает их уроки в текущем", () => {
    expect(expectedIncome(lessons, price, "2026-12", "2026-11-17", "14:35", 120_000)).toEqual({ amount: 150_000, lessons: 1 });
  });
});

describe("lessonsAhead", () => {
  it("считает целые уроки по предоплате", () => {
    expect(lessonsAhead({ balance: 450_000, payment: { model: "package", pricePerLesson: 125_000 } })).toBe(3);
  });

  it("ноль при долге и нулевом балансе", () => {
    expect(lessonsAhead({ balance: -100, payment: { model: "per_lesson", pricePerLesson: 100_000 } })).toBe(0);
    expect(lessonsAhead({ balance: 0, payment: { model: "per_lesson", pricePerLesson: 100_000 } })).toBe(0);
  });
});

describe("filterOperations", () => {
  const operations = [
    { id: "1", studentId: "a", kind: "payment" },
    { id: "2", studentId: "a", kind: "lesson" },
    { id: "3", studentId: "b", kind: "payment" },
  ] as FinanceOperation[];
  const nameOf = (id: string) => (id === "a" ? "Анна Мельник" : "Борис Орлов");

  it("фильтрует по типу", () => {
    expect(filterOperations(operations, "payment", "", nameOf).map((item) => item.id)).toEqual(["1", "3"]);
  });

  it("ищет по имени ученика", () => {
    expect(filterOperations(operations, "all", " орлов", nameOf).map((item) => item.id)).toEqual(["3"]);
  });

  it("возвращает всё без фильтров", () => {
    expect(filterOperations(operations, "all", "", nameOf)).toHaveLength(3);
  });
});



describe("доход по ученикам", () => {
  it("только оплаты, по убыванию суммы", () => {
    const op = (studentId: string, kind: "payment" | "lesson", amount: number) => ({ id: studentId + amount, date: "2026-11-10", studentId, kind, title: "", method: null, amount });
    expect(incomeByStudent([op("a", "payment", 100), op("b", "payment", 300), op("a", "payment", 50), op("a", "lesson", -100)])).toEqual([
      { studentId: "b", amount: 300, payments: 1 },
      { studentId: "a", amount: 150, payments: 2 },
    ]);
  });

  it("способ по подписи записи", () => {
    expect(methodOfTitle("Оплата · СБП")).toBe("sbp");
    expect(methodOfTitle("Оплата · Наличные")).toBe("cash");
    expect(methodOfTitle("Абонемент")).toBeNull();
  });
});
