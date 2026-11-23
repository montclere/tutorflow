import { describe, expect, it } from "vitest";
import { easeOutCubic, tween } from "./motion";

describe("easeOutCubic", () => {
  it("начинается с нуля, заканчивается единицей и ускоряется в начале", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  it("не выходит за границы", () => {
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(2)).toBe(1);
  });
});

describe("tween", () => {
  it("считает промежуточное значение", () => {
    expect(tween(100, 200, 0)).toBe(100);
    expect(tween(100, 200, 0.5)).toBe(150);
    expect(tween(200, 100, 1)).toBe(100);
  });
});
