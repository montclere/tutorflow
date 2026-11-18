import { describe, expect, it } from "vitest";
import type { Drill } from "../mocks/types";
import { nextDrill, normalizeAnswer, startTrainer, submitAnswer } from "./trainer";

const drills: Drill[] = [
  { number: 6, question: ["a"], answer: "5", hint: "", solution: "" },
  { number: 7, question: ["b"], answer: "3.5", hint: "", solution: "" },
];

describe("trainer", () => {
  it("заменяет запятую и обрезает пробелы", () => {
    expect(normalizeAnswer(" 3,5 ")).toBe("3.5");
  });

  it("не принимает пустой ответ", () => {
    expect(submitAnswer(startTrainer(0), drills, "  ")).toBeNull();
  });

  it("засчитывает верный ответ и увеличивает счётчик", () => {
    const next = submitAnswer(startTrainer(17), drills, "5");
    expect(next).toMatchObject({ phase: "correct", solved: 18 });
  });

  it("не меняет счётчик при неверном ответе", () => {
    const next = submitAnswer(startTrainer(17), drills, "4");
    expect(next).toMatchObject({ phase: "wrong", solved: 17 });
  });

  it("переходит к следующей задаче и очищает ответ", () => {
    const solved = submitAnswer(startTrainer(0), drills, "5");
    if (!solved) throw new Error("ответ не принят");
    expect(nextDrill(solved)).toEqual({ index: 1, phase: "question", solved: 1, answer: "" });
  });

  it("повторяет задачи по кругу", () => {
    const state = { ...startTrainer(0), index: 3 };
    expect(submitAnswer(state, drills, "3,5")?.phase).toBe("correct");
  });
});
