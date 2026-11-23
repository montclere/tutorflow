import { describe, expect, it } from "vitest";
import type { Assignment, Work } from "../tasks/library";
import { studentAssignmentsOverview } from "./studentAssignments";

const works: Work[] = [
  { id: "h", title: "Домашняя работа", kind: "homework", items: [], createdAt: "2026-11-10" },
  { id: "t", title: "Тест", kind: "test", items: [], createdAt: "2026-11-10", test: { mode: "training", attempts: 1, timeLimitMin: null } },
];
const assignment = (id: string, due: string, status: Assignment["status"] = "todo"): Assignment => ({ id, workId: "h", studentId: "s", assignedAt: "2026-11-10", due, status, attempts: [], reveal: "now" });
const attempt = { startedAt: 1, finishedAt: 2, answers: {}, results: {} };
const overview = (items: Assignment[], bank = works) => studentAssignmentsOverview("s", items, bank, "2026-11-17");

describe("STUDENT-TASKS-UI-2: обзор выдач ученика", () => {
  it("считает только собственные выдачи с существующими работами", () => {
    const items = [assignment("one", "2026-11-20"), assignment("wait", "2026-11-15", "wait"), assignment("done", "2026-11-14", "done"), { ...assignment("other", "2026-11-11"), studentId: "other" }, { ...assignment("missing", "2026-11-12"), workId: "missing" }];
    const result = overview(items);
    expect(result.active).toBe(2);
    expect(result.notStarted).toBe(1);
    expect(result.deadline).toBe("2026-11-20");
    expect(result.entries.map((item) => item.assignment.id)).toEqual(["one", "wait", "done"]);
  });
  it("выбирает до двух наиболее срочных todo, затем wait, сохраняя источники", () => {
    const items = [assignment("late", "2026-11-22"), assignment("waiting", "2026-11-10", "wait"), assignment("urgent", "2026-11-16")];
    expect(overview(items).leading.map((item) => item.assignment.id)).toEqual(["urgent", "late"]);
    expect(items.map((item) => item.id)).toEqual(["late", "waiting", "urgent"]);
    expect(overview(items.slice(0, 2)).leading.map((item) => item.assignment.id)).toEqual(["late", "waiting"]);
  });
  it("считает сегодняшний срок действующим, просроченными только todo", () => {
    const result = overview([assignment("past", "2026-11-16"), assignment("today", "2026-11-17"), assignment("wait", "2026-11-15", "wait")]);
    expect(result.entries.map((item) => item.overdue)).toEqual([true, false, false]);
    expect(result.deadline).toBe("2026-11-16");
  });
  it("возвращённая работа с попыткой не считается не начатой", () => {
    const item = { ...assignment("returned", "2026-11-20"), attempts: [attempt], returned: "Доработать" };
    const result = overview([item]);
    expect(result.active).toBe(1);
    expect(result.notStarted).toBe(0);
    expect(result.entries[0]?.startable).toBe(true);
  });
  it("сохраняет ограничения повторных попыток существующей модели", () => {
    const result = overview([{ ...assignment("test", "2026-11-20", "done"), workId: "t", attempts: [attempt] }]);
    expect(result.entries[0]?.startable).toBe(false);
    expect(result.leading).toEqual([]);
    expect(result.active).toBe(0);
    expect(result.deadline).toBeNull();
  });
  it("не создаёт показатели и карточки при отсутствии данных", () => {
    expect(overview([])).toEqual({ entries: [], leading: [], active: 0, notStarted: 0, deadline: null });
    expect(overview([assignment("one", "2026-11-20")], []).entries).toEqual([]);
  });
});
