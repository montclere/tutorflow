import { describe, expect, it } from "vitest";
import { addRating, getRatings, isRated, satisfaction } from "./ratings";

describe("оценка урока", () => {
  it("средняя с одним знаком и число оценок", () => {
    expect(satisfaction(getRatings(), "ivanov")).toMatchObject({ average: 4.7, count: 3 });
    expect(satisfaction(getRatings(), "nobody")).toBeNull();
  });

  it("повторная оценка того же урока заменяет прежнюю", () => {
    addRating({ studentId: "ivanov", date: "2026-11-16", topic: "Показательные уравнения", stars: 4 });
    addRating({ studentId: "ivanov", date: "2026-11-16", topic: "Показательные уравнения", stars: 5, comment: "Супер" });
    expect(isRated(getRatings(), "ivanov", "2026-11-16")).toBe(true);
    expect(satisfaction(getRatings(), "ivanov")).toMatchObject({ average: 4.8, count: 4, last: { stars: 5, comment: "Супер" } });
  });
});
