import { describe, expect, it } from "vitest";
import { nowIn, zonedParts, zonedToUtc } from "./zoned";

describe("zoned", () => {
  it("момент UTC — дата и время в зоне профиля, через полночь", () => {
    expect(zonedParts("2026-11-23T20:30:00Z", "Asia/Novosibirsk")).toEqual({ date: "2026-11-24", time: "03:30" });
    expect(zonedParts("2026-11-23T10:00:00Z", "Europe/Moscow")).toEqual({ date: "2026-11-23", time: "13:00" });
  });

  it("время на часах зоны — UTC до минуты", () => {
    expect(zonedToUtc("2026-11-23", "17:00", "Asia/Novosibirsk")).toBe("2026-11-23T10:00:00Z");
    expect(zonedToUtc("2026-11-24", "00:15", "Europe/Moscow")).toBe("2026-11-23T21:15:00Z");
  });

  it("учитывает летнее время", () => {
    expect(zonedToUtc("2026-07-01", "12:00", "Europe/Berlin")).toBe("2026-07-01T10:00:00Z");
    expect(zonedToUtc("2026-12-01", "12:00", "Europe/Berlin")).toBe("2026-12-01T11:00:00Z");
    expect(zonedParts(zonedToUtc("2026-03-29", "12:00", "Europe/Berlin"), "Europe/Berlin")).toEqual({ date: "2026-03-29", time: "12:00" });
  });

  it("сегодня и сейчас — в зоне профиля", () => {
    expect(nowIn("Asia/Novosibirsk", Date.parse("2026-11-19T18:05:00Z"))).toEqual({ today: "2026-11-20", now: "01:05" });
  });
});
