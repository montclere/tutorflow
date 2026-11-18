import { describe, expect, it } from "vitest";
import { appendExchange } from "./chat";

describe("appendExchange", () => {
  it("игнорирует пустой запрос", () => {
    expect(appendExchange([], "   ", () => "ответ")).toBeNull();
  });

  it("добавляет сообщение и заготовленный ответ", () => {
    const result = appendExchange([], " сделай сложнее ", (text) => `ок: ${text}`);
    expect(result).toEqual([
      { author: "me", text: "сделай сложнее" },
      { author: "ai", text: "ок: сделай сложнее" },
    ]);
  });
});
