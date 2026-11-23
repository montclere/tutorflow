import { describe, expect, it } from "vitest";
import { cycleIndex, keyToIndex } from "./cycle";

describe("cycleIndex", () => {
  it("идёт по кругу в обе стороны", () => {
    expect(cycleIndex(4, 1, 5)).toBe(0);
    expect(cycleIndex(0, -1, 5)).toBe(4);
    expect(cycleIndex(2, 1, 5)).toBe(3);
  });
});

describe("keyToIndex", () => {
  it("переводит стрелки, Home и End в индекс", () => {
    expect(keyToIndex("ArrowRight", 1, 5)).toBe(2);
    expect(keyToIndex("ArrowDown", 4, 5)).toBe(0);
    expect(keyToIndex("ArrowLeft", 0, 5)).toBe(4);
    expect(keyToIndex("ArrowUp", 3, 5)).toBe(2);
    expect(keyToIndex("Home", 3, 5)).toBe(0);
    expect(keyToIndex("End", 0, 5)).toBe(4);
  });

  it("не реагирует на остальные клавиши", () => {
    expect(keyToIndex("Enter", 1, 5)).toBeNull();
    expect(keyToIndex("a", 1, 5)).toBeNull();
  });
});
