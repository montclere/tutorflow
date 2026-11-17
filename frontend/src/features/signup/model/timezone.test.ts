import { describe, expect, it } from "vitest";
import { describeTimezone, formatUtcOffset } from "./timezone";

const cities = { Novosibirsk: "Новосибирск" };

describe("часовой пояс", () => {
  it("показывает русское название города и смещение", () => {
    expect(describeTimezone("Asia/Novosibirsk", 420, cities)).toBe("Новосибирск (UTC+7)");
  });

  it("без перевода показывает название зоны", () => {
    expect(describeTimezone("America/Argentina/Buenos_Aires", -180, cities)).toBe(
      "America/Argentina/Buenos_Aires (UTC-3)",
    );
  });

  it("форматирует смещение с минутами и нулевое", () => {
    expect(formatUtcOffset(330)).toBe("UTC+5:30");
    expect(formatUtcOffset(0)).toBe("UTC+0");
  });
});
