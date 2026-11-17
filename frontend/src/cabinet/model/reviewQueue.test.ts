import { describe, expect, it } from "vitest";
import { nextReviewIndex } from "./reviewQueue";

describe("nextReviewIndex", () => {
  it("идёт к следующей работе", () => {
    expect(nextReviewIndex(0, 4)).toBe(1);
  });

  it("возвращается к началу после последней", () => {
    expect(nextReviewIndex(3, 4)).toBe(0);
  });

  it("не ломается на пустой очереди", () => {
    expect(nextReviewIndex(0, 0)).toBe(0);
  });
});
