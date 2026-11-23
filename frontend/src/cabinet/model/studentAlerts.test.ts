import { describe, expect, it } from "vitest";
import { getStudent, getStudentDetails } from "../data";
import { studentAlerts } from "./studentAlerts";

describe("studentAlerts", () => {
  it("должник с невыполненной домашкой и без Telegram", () => {
    const student = getStudent("petrov");
    expect(studentAlerts(student, getStudentDetails("petrov"), "2026-11-21").map((alert) => alert.kind)).toEqual(["debt", "overdue", "telegram"]);
  });

  it("работа на проверке", () => {
    expect(studentAlerts(getStudent("ivanov"), getStudentDetails("ivanov"), "2026-11-17")).toContainEqual({ kind: "review", count: 1 });
  });

  it("без расписания", () => {
    expect(studentAlerts(getStudent("sokolov"), getStudentDetails("sokolov"), "2026-11-17").map((alert) => alert.kind)).toContain("noSchedule");
  });
});
