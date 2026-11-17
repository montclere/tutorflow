import type { FinanceMock, FinanceOperation } from "./types";

export const financeToday = "2026-11-17";

const op = (
  id: string,
  date: string,
  studentId: string,
  kind: FinanceOperation["kind"],
  title: string,
  method: FinanceOperation["method"],
  amount: number,
): FinanceOperation => ({ id, date, studentId, kind, title, method, amount });

export const finance: FinanceMock = {
  history: [
    { month: "2026-06", received: 6_120_000, payments: 31, lessons: 43 },
    { month: "2026-07", received: 5_400_000, payments: 28, lessons: 39 },
    { month: "2026-08", received: 6_350_000, payments: 33, lessons: 46 },
    { month: "2026-09", received: 7_020_000, payments: 36, lessons: 50 },
    { month: "2026-10", received: 7_357_000, payments: 38, lessons: 52 },
    { month: "2026-11", received: 8_240_000, payments: 42, lessons: 54 },
  ],
  debtDays: { petrov: 3 },
  operations: [
    op("n18", "2026-11-17", "smirnova", "payment", "Оплата по ссылке", "sbp", 400_000),
    op("n17", "2026-11-17", "orlova", "lesson", "Урок проведён", null, -120_000),
    op("n16", "2026-11-16", "ivanov", "lesson", "Урок проведён", null, -150_000),
    op("n15", "2026-11-16", "volkova", "lesson", "Урок проведён", null, -130_000),
    op("n14", "2026-11-16", "orlova", "lesson", "Урок проведён", null, -120_000),
    op("n13", "2026-11-15", "orlova", "payment", "Абонемент, 8 уроков", "transfer", 960_000),
    op("n12", "2026-11-13", "petrov", "lesson", "Урок проведён", null, -120_000),
    op("n11", "2026-11-13", "ivanov", "lesson", "Урок проведён", null, -150_000),
    op("n10", "2026-11-12", "smirnova", "lesson", "Урок проведён", null, -125_000),
    op("n09", "2026-11-11", "volkova", "payment", "Оплата по ссылке", "sbp", 300_000),
    op("n08", "2026-11-11", "smirnova", "lesson", "Урок проведён", null, -125_000),
    op("n07", "2026-11-10", "ivanov", "payment", "Оплата наличными", "cash", 300_000),
    op("n06", "2026-11-10", "ivanov", "lesson", "Урок проведён", null, -150_000),
    op("n05", "2026-11-09", "ivanov", "correction", "Возврат за перенесённый урок", null, 150_000),
    op("n04", "2026-11-06", "petrov", "payment", "Оплата по ссылке", "sbp", 120_000),
    op("n03", "2026-11-05", "volkova", "payment", "Оплата переводом", "transfer", 300_000),
    op("n02", "2026-11-03", "ivanov", "correction", "Списание за неявку", null, -150_000),
    op("n01", "2026-11-02", "smirnova", "payment", "Оплата по ссылке", "sbp", 250_000),
    op("o03", "2026-10-30", "orlova", "lesson", "Урок проведён", null, -120_000),
    op("o02", "2026-10-28", "smirnova", "payment", "Абонемент, 8 уроков", "sbp", 1_000_000),
    op("o01", "2026-10-27", "petrov", "lesson", "Урок проведён", null, -120_000),
  ],
};
