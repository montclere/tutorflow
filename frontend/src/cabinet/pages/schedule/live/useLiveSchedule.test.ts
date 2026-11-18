import { describe, expect, it } from "vitest";
import type { LiveLesson } from "../../../api/lessons";
import { mergeLessons, windowOf } from "./useLiveSchedule";

const lesson = (id: string, startsAt: string, status: LiveLesson["status"] = "scheduled") => ({ id, startsAt, status }) as LiveLesson;

describe("useLiveSchedule", () => {
  it("окно недели — от полуночи понедельника до полуночи следующего понедельника в зоне профиля", () => {
    expect(windowOf({ from: "2026-11-23", to: "2026-11-29" }, "Asia/Novosibirsk")).toEqual({ from: "2026-11-22T17:00:00Z", to: "2026-11-29T17:00:00Z" });
  });

  it("изменённый урок заменяется, новые добавляются по времени", () => {
    const merged = mergeLessons([lesson("a", "2026-11-23T10:00:00Z"), lesson("b", "2026-11-25T10:00:00Z")], [lesson("a", "2026-11-23T10:00:00Z", "cancelled"), lesson("c", "2026-11-24T10:00:00Z")]);
    expect(merged.map((item) => `${item.id}:${item.status}`)).toEqual(["a:cancelled", "c:scheduled", "b:scheduled"]);
  });
});
