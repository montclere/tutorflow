import { describe, expect, it } from "vitest";
import { getPractice, pickTask, practiceEvidence, practiceNumbers, recordPractice } from "./practice";

describe("тренажёр", () => {
  it("номера — только с задачами автопроверки", () => {
    const numbers = practiceNumbers("ege-math-profile");
    expect(numbers.has(6)).toBe(true);
    expect(numbers.has(13)).toBe(false);
  });

  it("по номеру: сначала свежие задачи банка, потом аналоги", () => {
    const recent: string[] = [];
    for (let seed = 0; seed < 12; seed += 1) {
      const task = pickTask("number", { exam: "ege-math-profile", number: 6, weak: [], seed, recent });
      expect(task?.number).toBe(6);
      if (task) recent.push(task.id);
    }
    expect(recent.some((id) => id.includes("-ai-"))).toBe(true);
  });

  it("слабые места — по слабым номерам; ошибка попадает в «Мои ошибки» и в прогресс", () => {
    const task = pickTask("weak", { exam: "ege-math-profile", weak: [4], seed: 3, recent: [] });
    expect(task?.number).toBe(4);
    if (!task) return;
    const before = getPractice().weekSolved;
    recordPractice(task, false);
    expect(getPractice().mistakes[0]?.id).toBe(task.id);
    expect(getPractice().weekSolved).toBe(before + 1);
    expect(pickTask("mistakes", { exam: "ege-math-profile", weak: [], seed: 1, recent: [] })?.id).toBe(task.id);
    expect(practiceEvidence("ege-math-profile")["n:4"]).toEqual({ correct: 0, total: 1 });
    recordPractice(task, true);
    expect(getPractice().mistakes).toHaveLength(0);
  });
});
