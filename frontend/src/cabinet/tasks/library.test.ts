import { describe, expect, it } from "vitest";
import { bankTasks } from "./bank";
import { assignedTasksOf, assignWork, attemptScore, canStart, getLibrary, gradeAttempt, notForTest, saveWork, submitAttempt, workAverage } from "./library";
import type { TaskItem } from "./types";

const task = (id: string) => bankTasks.find((item) => item.id === id) as TaskItem;

describe("библиотека заданий", () => {
  it("тест не принимает развёрнутые задачи", () => {
    expect(notForTest([task("bank-6"), task("bank-19")]).map((item) => item.id)).toEqual(["bank-19"]);
  });

  it("проверка попытки и счёт: развёрнутое ждёт репетитора", () => {
    const items = [task("bank-6"), task("bank-8"), task("bank-19")];
    const results = gradeAttempt(items, { "bank-6": { kind: "number", value: "4" }, "bank-8": { kind: "number", value: "7" }, "bank-19": { kind: "extended", photos: ["a"] } });
    expect(attemptScore(items, results)).toEqual({ correct: 1, total: 2, points: 1, maxPoints: 4, pending: 1, percent: 50 });
  });

  it("выдача → попытка → мониторинг ученика", () => {
    const work = saveWork({ kind: "test", title: "Проба", items: [task("bank-6"), task("bank-8")], createdAt: "2026-11-17", test: { mode: "control", timeLimitMin: 10, attempts: 1 } });
    const [assignment] = assignWork(work.id, { studentIds: ["petrov"], due: "2026-11-24", reveal: "now", today: "2026-11-17" });
    expect(assignment && canStart(assignment, work)).toBe(true);
    expect(assignedTasksOf("petrov")[0]).toMatchObject({ title: "Проба · тест", status: "todo", due: "2026-11-24" });
    submitAttempt(assignment?.id ?? "", work.items, { "bank-6": { kind: "number", value: "4" }, "bank-8": { kind: "number", value: "1" } }, 0, 6 * 60_000);
    const updated = getLibrary().assignments.find((item) => item.id === assignment?.id);
    expect(updated && canStart(updated, work)).toBe(false);
    expect(assignedTasksOf("petrov")[0]).toMatchObject({ status: "done", score: { correct: 1, total: 2 }, timeMin: 6, mistakes: [{ number: "6", answer: "1", correct: "13" }] });
    expect(workAverage(work.id)).toBe(50);
  });
});
