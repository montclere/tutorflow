import { describe, expect, it } from "vitest";
import { paymentHistory } from "./studentPayments";

describe("STUDENT-PAYMENTS-UI-1: представление истории", () => {
  it("фильтрует поступления/списания по знаку и сортирует даты без изменения источника", () => {
    const income = { date: "2026-11-10", title: "Оплата", amount: 300000 };
    const older = { date: "2026-11-07", title: "Урок", amount: -150000 };
    const newer = { date: "2026-11-14", title: "Урок", amount: -150000 };
    const zero = { date: "2026-11-01", title: "Нулевая", amount: 0 };
    const source = [income, older, zero, newer];
    expect(paymentHistory(source, "all")).toEqual([newer, income, older, zero]);
    expect(paymentHistory(source, "payment")).toEqual([income]);
    expect(paymentHistory(source, "lesson")).toEqual([newer, older]);
    expect(source).toEqual([income, older, zero, newer]);
    expect(paymentHistory([], "all")).toEqual([]);
  });
});
