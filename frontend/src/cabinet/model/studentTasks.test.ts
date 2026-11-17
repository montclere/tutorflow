import { describe, expect, it } from "vitest";
import { studentDetails } from "../mocks/studentDetails";
import type { AssignedTask } from "../mocks/types";
import { taskPercent, taskStats } from "./studentTasks";

function task(partial: Partial<AssignedTask>): AssignedTask {
  return { title: "Задание", status: "done", assignedAt: "2026-11-01", score: null, mistakes: [], ...partial };
}

describe("taskPercent", () => {
  it("округляет долю верных ответов", () => {
    expect(taskPercent({ correct: 9, total: 10 })).toBe(90);
    expect(taskPercent({ correct: 2, total: 3 })).toBe(67);
    expect(taskPercent({ correct: 0, total: 0 })).toBe(0);
  });
});

describe("taskStats", () => {
  it("считает средний результат по числу задач, а не по числу работ", () => {
    const stats = taskStats([task({ score: { correct: 9, total: 10 } }), task({ score: { correct: 1, total: 2 } })]);
    expect(stats.checked).toBe(2);
    expect(stats.percent).toBe(83);
  });

  it("не считает невыполненные и непроверенные работы", () => {
    const stats = taskStats([task({ status: "todo" }), task({ status: "wait" })]);
    expect(stats).toEqual({ checked: 0, percent: null, mistakes: 0, topTopic: null });
  });

  it("находит тему с наибольшим числом ошибок, при равенстве берёт более свежую", () => {
    const mistake = (topic: string) => ({ number: "1", topic, answer: "1", correct: "2" });
    const stats = taskStats([
      task({ score: { correct: 8, total: 10 }, mistakes: [mistake("ОДЗ"), mistake("Знаки")] }),
      task({ score: { correct: 9, total: 10 }, mistakes: [mistake("Знаки")] }),
    ]);
    expect(stats.mistakes).toBe(3);
    expect(stats.topTopic).toBe("Знаки");
    expect(taskStats([task({ score: { correct: 8, total: 10 }, mistakes: [mistake("ОДЗ"), mistake("Знаки")] })]).topTopic).toBe("ОДЗ");
  });
});

describe("моки заданий учеников", () => {
  it("число ошибок совпадает с результатом", () => {
    for (const details of Object.values(studentDetails)) {
      for (const item of details.tasks) {
        if (item.score) expect(item.mistakes).toHaveLength(item.score.total - item.score.correct);
        else expect(item.mistakes).toHaveLength(0);
      }
    }
  });
});
