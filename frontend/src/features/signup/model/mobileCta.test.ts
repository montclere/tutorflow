import { describe, expect, it } from "vitest";
import { applyVisibility, shouldShowMobileCta } from "./mobileCta";

describe("applyVisibility", () => {
  it("добавляет появившиеся и убирает ушедшие с экрана цели", () => {
    const start = new Set(["hero-cta"]);
    const next = applyVisibility(start, [
      { id: "hero-cta", visible: false },
      { id: "signup", visible: true },
    ]);
    expect([...next]).toEqual(["signup"]);
  });

  it("не меняет исходное множество", () => {
    const start = new Set(["hero-cta"]);
    applyVisibility(start, [{ id: "hero-cta", visible: false }]);
    expect([...start]).toEqual(["hero-cta"]);
  });
});

describe("shouldShowMobileCta", () => {
  it("показывает кнопку, только когда ни одна цель не видна", () => {
    expect(shouldShowMobileCta(new Set())).toBe(true);
    expect(shouldShowMobileCta(new Set(["signup"]))).toBe(false);
  });
});
