import { describe, expect, it } from "vitest";
import { cardColor } from "./cardColor";

describe("cardColor", () => {
  it("один и тот же ID — один цвет", () => {
    expect(cardColor("4ab36461-c66f")).toBe(cardColor("4ab36461-c66f"));
  });
});
