import { describe, expect, it } from "vitest";
import { respond, type AssistantContext } from "./assistant";
import { bankTasks } from "./bank";
import type { TaskItem } from "./types";

const base: AssistantContext = {
  params: { subject: "math", exam: "ege-math-profile", difficulty: null, count: 5 },
  draft: [],
  seed: 1,
  students: [{ name: "Александр Иванов", topics: ["Логарифмические уравнения"], numbers: [13] }],
};
const task = (id: string) => bankTasks.find((item) => item.id === id) as TaskItem;

describe("ИИ-помощник", () => {
  it("вне темы — вежливый отказ", () => {
    expect(respond("какая погода в Москве?", base).kind).toBe("refused");
  });

  it("подбирает задачи по номеру и добирает аналогами", () => {
    const reply = respond("добавь 8 задач №6", base);
    expect(reply.kind).toBe("draft");
    if (reply.kind !== "draft") return;
    expect(reply.items).toHaveLength(8);
    expect(reply.items.every((item) => item.number === 6)).toBe(true);
    expect(reply.items.some((item) => item.source === "ai")).toBe(true);
  });

  it("подбирает по теме", () => {
    const reply = respond("подбери 2 задачи на вероятность", base);
    expect(reply.kind === "draft" && reply.items.every((item) => item.topic.includes("вероятность"))).toBe(true);
  });

  it("аналоги только для вычислимых предметов", () => {
    expect(respond("аналоги №6", base).kind).toBe("draft");
    expect(respond("аналоги №4", { ...base, params: { ...base.params, subject: "russian", exam: "ege-russian" } }).kind).toBe("info");
  });

  it("замени №1 — та же позиция, тот же номер", () => {
    const reply = respond("замени №1", { ...base, draft: [task("bank-6"), task("bank-8")] });
    expect(reply.kind).toBe("draft");
    if (reply.kind !== "draft") return;
    expect(reply.items[0]?.id).not.toBe("bank-6");
    expect(reply.items[0]?.number).toBe(6);
    expect(reply.items[1]?.id).toBe("bank-8");
  });

  it("проверка для теста называет задачи без автопроверки", () => {
    const reply = respond("можно сделать тест?", { ...base, draft: [task("bank-6"), task("bank-19")] });
    expect(reply).toMatchObject({ kind: "info" });
    expect(reply.text).toContain("2 (развёрнутый ответ)");
  });

  it("работа над ошибками по имени ученика", () => {
    const reply = respond("работа над ошибками Александра, 3 задачи", base);
    expect(reply.kind).toBe("draft");
    if (reply.kind !== "draft") return;
    expect(reply.items.length).toBeGreaterThan(0);
  });
});
