import { beforeEach, describe, expect, it } from "vitest";
import { bankTasks } from "./bank";
import { addToDraft, clearDraft, DRAFT_LIMIT, draftSummary, getDraft, moveInDraft, removeFromDraft } from "./draft";
import type { TaskItem } from "./types";

const task = (id: string) => bankTasks.find((item) => item.id === id) as TaskItem;

beforeEach(() => clearDraft());

describe("черновик", () => {
  it("добавляет без повторов, двигает и удаляет", () => {
    expect(addToDraft([task("bank-1"), task("bank-2"), task("bank-1")])).toBe(2);
    expect(addToDraft([task("bank-2")])).toBe(0);
    moveInDraft("bank-2", -1);
    expect(getDraft().items.map((item) => item.id)).toEqual(["bank-2", "bank-1"]);
    removeFromDraft("bank-2");
    expect(getDraft().items.map((item) => item.id)).toEqual(["bank-1"]);
  });

  it("не больше лимита", () => {
    const many = Array.from({ length: DRAFT_LIMIT + 5 }, (_, index) => ({ ...task("bank-1"), id: `x-${index}` }));
    expect(addToDraft(many)).toBe(DRAFT_LIMIT);
  });

  it("сводка: баллы, время, автопроверка, предметы", () => {
    const summary = draftSummary([task("bank-6"), task("bank-19")]);
    expect(summary).toMatchObject({ count: 2, points: 3, auto: 1, subjects: ["math"] });
  });
});
