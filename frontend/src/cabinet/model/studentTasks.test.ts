import { describe, expect, it } from "vitest";
import { studentDetails } from "../mocks/studentDetails";
import type { AssignedTask } from "../mocks/types";
import { homeworkSummary, homeworkTimeline, taskPercent, taskStats, weakTopics } from "./studentTasks";

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

describe("мониторинг домашек", () => {
  const task = (title: string, extra: Partial<AssignedTask>): AssignedTask => ({ title, status: "done", assignedAt: "2026-11-01", score: null, mistakes: [], ...extra });
  const tasks: AssignedTask[] = [
    task("a", { submittedAt: "2026-11-05", due: "2026-11-04", score: { correct: 6, total: 10 }, mistakes: [{ number: "1", topic: "ОДЗ", answer: "1", correct: "2" }] }),
    task("b", { submittedAt: "2026-11-02", due: "2026-11-03", score: { correct: 5, total: 10 }, mistakes: [{ number: "1", topic: "ОДЗ", answer: "1", correct: "2" }, { number: "2", topic: "Графики", answer: "1", correct: "2" }] }),
    task("c", { submittedAt: "2026-11-08", score: { correct: 9, total: 10 } }),
    task("d", { submittedAt: "2026-11-09", score: { correct: 8, total: 10 } }),
    task("e", { submittedAt: "2026-11-10", score: { correct: 10, total: 10 } }),
    task("f", { submittedAt: "2026-11-01", score: { correct: 7, total: 10 } }),
    task("todo", { status: "todo", due: "2026-11-15" }),
    task("late", { status: "todo", due: "2026-11-10" }),
    task("wait", { status: "wait", submittedAt: "2026-11-11" }),
  ];

  it("график — по дате сдачи", () => {
    expect(homeworkTimeline(tasks).map((point) => `${point.title}:${point.percent}`)).toEqual(["f:70", "b:50", "a:60", "c:90", "d:80", "e:100"]);
  });

  it("слабые темы по частоте", () => {
    expect(weakTopics(tasks)).toEqual([
      { topic: "ОДЗ", count: 2 },
      { topic: "Графики", count: 1 },
    ]);
  });

  it("сводка: просрочено, на проверке, в срок и тренд", () => {
    expect(homeworkSummary(tasks, "2026-11-12")).toEqual({ todo: 2, overdue: 1, wait: 1, done: 6, onTime: 50, trend: 30 });
  });
});
