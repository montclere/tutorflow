import { describe, expect, it } from "vitest";
import { levelOf, mergeEvidence, studentProgress, unitKey, type StudentGoal } from "./progress";

const exam: StudentGoal = { kind: "exam", exam: "ege-math-profile" };
const topics: StudentGoal = { kind: "topics", subject: "math", title: "Алгебра · 10 класс", topics: ["Тригонометрия", "Тождества"] };

describe("прогресс ученика", () => {
  it("уровень — только с трёх ответов", () => {
    expect(levelOf({ correct: 2, total: 2 })).toBeNull();
    expect(levelOf({ correct: 9, total: 10 })).toBe(3);
    expect(levelOf({ correct: 7, total: 10 })).toBe(2);
    expect(levelOf({ correct: 5, total: 10 })).toBe(1);
    expect(levelOf({ correct: 2, total: 10 })).toBe(0);
  });

  it("экзамен: номера, готовность, прогноз баллов и слабые места", () => {
    const progress = studentProgress(exam, { "n:1": { correct: 10, total: 10 }, "n:6": { correct: 3, total: 10 }, "n:13": { correct: 1, total: 4 } });
    expect(progress.mode).toBe("exam");
    expect(progress.mastered).toBe(1);
    expect(progress.forecast).toEqual({ score: 2, max: 18 });
    expect(progress.weak.map((unit) => unit.number)).toEqual([13, 6]);
  });

  it("без экзамена: темы и без прогноза баллов", () => {
    const progress = studentProgress(topics, { "t:Тригонометрия": { correct: 8, total: 10 } });
    expect(progress.forecast).toBeNull();
    expect(progress.units.map((unit) => unit.level)).toEqual([2, null]);
  });

  it("задача относится к номеру экзамена или к теме", () => {
    expect(unitKey(exam, { exam: "ege-math-profile", number: 6, topic: "Уравнения" })).toBe("n:6");
    expect(unitKey(exam, { exam: "oge-math", number: 6, topic: "Дроби" })).toBeNull();
    expect(unitKey(topics, { topic: "Тригонометрия: формулы приведения" })).toBe("t:Тригонометрия");
    expect(mergeEvidence({ a: { correct: 1, total: 2 } }, { a: { correct: 1, total: 1 } })).toEqual({ a: { correct: 2, total: 3 } });
  });
});
