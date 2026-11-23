import { describe, expect, it } from "vitest";
import type { Unit } from "../tasks/progress";
import { trainerRecommendations } from "./trainer";

const unit = (number: number, correct: number, total = 10): Unit => ({ key: `n:${number}`, number, label: `Тема ${number}`, correct, total, points: 1, level: null });

describe("STUDENT-TRAINER-UI-2: рекомендации", () => {
  it("выбирает до трёх самых слабых доступных номеров по доле, без ручной проверки", () => {
    const units = [unit(27, 0), unit(4, 9), unit(15, 3), unit(16, 4, 20), unit(12, 5)];
    expect(trainerRecommendations(units, new Set([4, 12, 15, 16])).map((item) => item.number)).toEqual([16, 15, 12]);
    expect(units.map((item) => item.number)).toEqual([27, 4, 15, 16, 12]);
  });
  it("не выдумывает рекомендации без прогресса или доступного банка", () => {
    expect(trainerRecommendations([], new Set([15]))).toEqual([]);
    expect(trainerRecommendations([unit(15, 3)], new Set())).toEqual([]);
  });
  it("показывает неизученные после изученных, не превращая их в нулевой прогресс", () => {
    const unknown = unit(4, 0, 0);
    expect(trainerRecommendations([unknown, unit(15, 3)], new Set([4, 15]))).toEqual([unit(15, 3), unknown]);
  });
  it("при одинаковой доле сохраняет порядок источника и исключает темы без номера", () => {
    expect(trainerRecommendations([{ ...unit(0, 0), number: undefined }, unit(16, 6, 20), unit(15, 3)], new Set([0, 15, 16])).map((item) => item.number)).toEqual([16, 15]);
  });
});
