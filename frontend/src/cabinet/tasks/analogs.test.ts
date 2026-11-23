import { describe, expect, it } from "vitest";
import { makeAnalogs } from "./analogs";
import { bankTasks } from "./bank";
import type { TaskItem } from "./types";

const task = (generator: string): TaskItem => bankTasks.find((item) => item.generator === generator) as TaskItem;

describe("makeAnalogs", () => {
  it("повторяемы по зерну и помечены как ИИ с проверенным ответом", () => {
    const first = makeAnalogs(task("exp-eq"), 3, 7);
    expect(makeAnalogs(task("exp-eq"), 3, 7)).toEqual(first);
    expect(first.every((item) => item.source === "ai" && item.verified && item.answer.kind === "number")).toBe(true);
    expect(new Set(first.map((item) => item.id)).size).toBe(3);
  });

  it("ответ сходится с условием: корень показательного уравнения", () => {
    for (const item of makeAnalogs(task("exp-eq"), 10, 42)) {
      const [, base, sup, rhs] = item.statement as [string, string, { sup: string }, string];
      const shift = Number(sup.sup.replace("x ", "").replace("− ", "-").replace("+ ", ""));
      const x = Number(item.answer.kind === "number" ? item.answer.value : NaN);
      expect(Number(base) ** (x + shift)).toBe(Number(rhs.replace(/[=\s.]/g, "")));
    }
  });

  it("для невычислимых задач аналогов нет", () => {
    const russian = bankTasks.find((item) => item.subject === "russian") as TaskItem;
    expect(makeAnalogs(russian, 3, 1)).toEqual([]);
  });
});
