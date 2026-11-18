import { describe, expect, it } from "vitest";
import { legalDocOf } from "./legal";

describe("legalDocOf", () => {
  it("узнаёт адреса оферты и политики", () => {
    expect(legalDocOf("/offer")).toBe("offer");
    expect(legalDocOf("/privacy")).toBe("privacy");
  });

  it("не путает главную и другие адреса с документами", () => {
    expect(legalDocOf("/")).toBeNull();
    expect(legalDocOf("/offer/extra")).toBeNull();
    expect(legalDocOf("/teacher")).toBeNull();
  });
});
