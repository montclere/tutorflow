import { describe, expect, it } from "vitest";
import { attentionItems } from "./attention";

const empty = { month: "2026-11", debtors: [], packages: [], expected: { amount: 0, lessons: 0 } };

describe("FINANCE-UI-1: внимание по существующим данным", () => {
  it("не придумывает события при пустом результате", () => {
    expect(attentionItems(empty)).toEqual([]);
  });

  it("сохраняет все долги и заканчивающиеся абонементы в порядке приоритета", () => {
    const debt = { studentId: "a", amount: 120_000, days: 3, payer: null };
    const ending = { studentId: "b", left: 1, total: 8, ending: true };
    const data = { ...empty, debtors: [debt], packages: [ending, { studentId: "c", left: 6, total: 8, ending: false }] };
    expect(attentionItems(data)).toEqual([
      { kind: "debt", key: "debt:a", row: debt },
      { kind: "package", key: "package:b", row: ending },
    ]);
    expect(data.packages).toHaveLength(2);
  });

  it("показывает прогноз как количество уроков выбранного месяца, без выдуманного числа платежей", () => {
    expect(attentionItems({ ...empty, month: "2026-12", expected: { amount: 700_000, lessons: 4 } })).toEqual([
      { kind: "expected", key: "expected:2026-12", month: "2026-12", lessons: 4 },
    ]);
    expect(attentionItems({ ...empty, expected: { amount: 120_000, lessons: 0 } })).toEqual([]);
  });

  it("не теряет должников за пределами компактных трёх строк", () => {
    const debtors = Array.from({ length: 5 }, (_, i) => ({ studentId: String(i), amount: 100, days: 1, payer: null }));
    expect(attentionItems({ ...empty, debtors })).toHaveLength(5);
  });
});
