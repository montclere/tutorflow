import { describe, expect, it } from "vitest";
import type { AssignedTask, RecentLesson } from "../mocks/types";
import { overviewHistory } from "./studentOverview";

const lesson = (date: string): RecentLesson => ({ date, topic: "Тема", status: "done", homework: null });
const task = (date: string, submittedAt?: string): AssignedTask => ({ assignedAt: date, submittedAt, title: "Работа", status: "done", score: { correct: 1, total: 2 }, mistakes: [] });

describe("STUDENT-OVERVIEW-1: период обзора", () => {
  it("включает обе границы 14 дней, исключает будущее и не меняет историю", () => {
    const lessons = [lesson("2026-11-04"), lesson("2026-11-05"), lesson("2026-11-18"), lesson("2026-11-19")];
    expect(overviewHistory(lessons, [], "2026-11-18", 14).lessons.map((item) => item.date)).toEqual(["2026-11-05", "2026-11-18"]);
    expect(lessons).toHaveLength(4);
  });
  it("месячный период возвращает более ранние уроки и учитывает дату сдачи ДЗ", () => {
    const tasks = [task("2026-10-01", "2026-11-05"), task("2026-11-05", "2026-11-19"), task("2026-10-19")];
    expect(overviewHistory([lesson("2026-10-19")], tasks, "2026-11-18", 31)).toEqual({ lessons: [lesson("2026-10-19")], tasks: [tasks[0], tasks[2]] });
    expect(overviewHistory([], tasks, "2026-11-18", 14).tasks).toEqual([tasks[0]]);
  });
  it("возвращает пустую историю при отсутствии записей", () => {
    expect(overviewHistory([], [], "2026-11-18", 14)).toEqual({ lessons: [], tasks: [] });
  });
});
