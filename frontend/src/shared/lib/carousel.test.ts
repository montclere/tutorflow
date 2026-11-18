import { describe, expect, it } from "vitest";
import { scrollEdges } from "./carousel";

describe("scrollEdges", () => {
  it("в начале ленты назад листать нельзя", () => {
    expect(scrollEdges(0, 800, 2000)).toEqual({ atStart: true, atEnd: false });
  });

  it("в конце ленты вперёд листать нельзя, с запасом на дробные пиксели", () => {
    expect(scrollEdges(1199.5, 800, 2000)).toEqual({ atStart: false, atEnd: true });
  });

  it("посередине можно в обе стороны", () => {
    expect(scrollEdges(400, 800, 2000)).toEqual({ atStart: false, atEnd: false });
  });

  it("если всё помещается, листать некуда", () => {
    expect(scrollEdges(0, 800, 800)).toEqual({ atStart: true, atEnd: true });
  });
});
