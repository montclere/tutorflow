import { describe, expect, it } from "vitest";
import { answerText, checkAnswer, emptyResponse, estimateMinutes, isAnswered, isAutoChecked, normalizeText, parseNumber } from "./check";

describe("checkAnswer", () => {
  it("число: запятая, точка, разные минусы", () => {
    expect(parseNumber(" −0,5 ")).toBe(-0.5);
    expect(checkAnswer({ kind: "number", value: "-0.5" }, { kind: "number", value: "−0,5" })).toBe(true);
    expect(checkAnswer({ kind: "number", value: "4" }, { kind: "number", value: "4 см" })).toBe(false);
  });

  it("текст: регистр, ё и пробелы не важны", () => {
    expect(normalizeText(" Тщетный. ")).toBe("тщетный");
    expect(checkAnswer({ kind: "text", values: ["зажжёт"] }, { kind: "text", value: "ЗАЖЖЕТ" })).toBe(true);
  });

  it("выбор: порядок и повторы не важны, лишний вариант — ошибка", () => {
    expect(checkAnswer({ kind: "choice", options: ["a", "b", "c"], correct: [0, 2] }, { kind: "choice", selected: [2, 0, 2] })).toBe(true);
    expect(checkAnswer({ kind: "choice", options: ["a", "b", "c"], correct: [0, 2] }, { kind: "choice", selected: [0, 1, 2] })).toBe(false);
  });

  it("соответствие — все пары", () => {
    const spec = { kind: "match" as const, left: ["А", "Б"], right: ["1", "2", "3"], pairs: [2, 0] };
    expect(checkAnswer(spec, { kind: "match", pairs: [2, 0] })).toBe(true);
    expect(checkAnswer(spec, { kind: "match", pairs: [2, null] })).toBe(false);
  });

  it("развёрнутый ответ проверяет репетитор", () => {
    expect(checkAnswer({ kind: "extended", criteria: "…" }, { kind: "extended", photos: [] })).toBeNull();
    expect(isAutoChecked({ answer: { kind: "extended", criteria: "…" }, verified: true })).toBe(false);
    expect(isAutoChecked({ answer: { kind: "number", value: "1" }, verified: false })).toBe(false);
  });

  it("ответ строкой и время", () => {
    expect(answerText({ kind: "choice", options: [], correct: [0, 3] })).toBe("14");
    expect(estimateMinutes([{ answer: { kind: "number", value: "1" }, difficulty: 2 }, { answer: { kind: "extended", criteria: "" }, difficulty: 3 }])).toBe(16);
  });

  it("пустой ответ и «ответ дан»", () => {
    const match = { kind: "match" as const, left: ["А", "Б"], right: ["1", "2"], pairs: [0, 1] };
    expect(isAnswered(emptyResponse(match))).toBe(false);
    expect(isAnswered({ kind: "match", pairs: [1, 0] })).toBe(true);
    expect(isAnswered({ kind: "number", value: "  " })).toBe(false);
  });
});
