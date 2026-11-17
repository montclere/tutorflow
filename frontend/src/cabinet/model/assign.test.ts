import { describe, expect, it } from "vitest";
import { canAssign, toggleSelected } from "./assign";

describe("toggleSelected", () => {
  it("добавляет и убирает ученика", () => {
    expect(toggleSelected([], "a")).toEqual(["a"]);
    expect(toggleSelected(["a", "b"], "a")).toEqual(["b"]);
  });
});

describe("canAssign", () => {
  it("требует выбранного ученика и срок не в прошлом", () => {
    expect(canAssign(["a"], "2026-11-20", "2026-11-17")).toBe(true);
    expect(canAssign(["a"], "2026-11-17", "2026-11-17")).toBe(true);
    expect(canAssign([], "2026-11-20", "2026-11-17")).toBe(false);
    expect(canAssign(["a"], "", "2026-11-17")).toBe(false);
    expect(canAssign(["a"], "2026-11-10", "2026-11-17")).toBe(false);
  });
});
