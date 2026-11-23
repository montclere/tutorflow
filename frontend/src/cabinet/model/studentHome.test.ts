import { describe, expect, it } from "vitest";
import type { Assignment, Work } from "../tasks/library";
import { growthShare, mainStudentAssignment, upcomingStudentHomeLessons, type StudentHomeLesson } from "./studentHome";

const work = (id: string): Work => ({ id, title: id, kind: "homework", createdAt: "2026-11-01", items: [] });
const assignment = (id: string, due: string, status: Assignment["status"] = "todo", studentId = "ivanov", workId = "work"): Assignment => ({ id, workId, due, studentId, assignedAt: "2026-11-01", reveal: "afterCheck", status, attempts: [] });
const lesson = (id: string, date: string, start: string, studentId = "ivanov"): StudentHomeLesson => ({ id, studentId, date, start, subject: "Русский язык", teacher: "Анна Кузнецова", kind: "russian" });

describe("STUDENT-MAIN-UI-2: подбор данных главной", () => {
  it("сохраняет прежнюю долю верных ответов слабой темы, включая пустую историю", () => {
    expect(growthShare({ correct: 3, total: 10 })).toBe(30);
    expect(growthShare({ correct: 5, total: 10 })).toBe(50);
    expect(growthShare({ correct: 13, total: 14 })).toBe(93);
    expect(growthShare({ correct: 0, total: 0 })).toBe(0);
  });
  it("выбирает ближайшую по сроку собственную активную выдачу с существующей работой", () => {
    const source = [assignment("later", "2026-11-22"), assignment("wait", "2026-11-19", "wait"), assignment("done", "2026-11-18", "done"), assignment("other", "2026-11-17", "todo", "petrov"), assignment("missing", "2026-11-16", "todo", "ivanov", "missing"), assignment("next", "2026-11-21")];
    const original = structuredClone(source);
    const works = [work("work")];
    expect(mainStudentAssignment("ivanov", source, works)).toEqual({ assignment: source[5], work: works[0] });
    expect(source).toEqual(original);
  });

  it("показывает работу на проверке при отсутствии todo, иначе честное пустое состояние", () => {
    const source = [assignment("wait", "2026-11-21", "wait")];
    expect(mainStudentAssignment("ivanov", source, [work("work")])?.assignment.id).toBe("wait");
    expect(mainStudentAssignment("petrov", source, [work("work")])).toBeNull();
    expect(mainStudentAssignment("ivanov", source, [])).toBeNull();
    expect(mainStudentAssignment("ivanov", [], [])).toBeNull();
  });

  it("выбирает будущие занятия только ученика, в порядке даты/времени и без мутации", () => {
    const source = [lesson("late", "2026-11-18", "17:30"), lesson("past", "2026-11-16", "15:00"), lesson("other", "2026-11-17", "15:00", "petrov"), lesson("early", "2026-11-18", "12:00"), lesson("today", "2026-11-17", "15:00"), lesson("started", "2026-11-17", "14:00")];
    const original = structuredClone(source);
    expect(upcomingStudentHomeLessons("ivanov", source, "2026-11-17", "14:35").map((item) => item.id)).toEqual(["today", "early", "late"]);
    expect(source).toEqual(original);
  });

  it("включает начало ровно сейчас, но не прошедшую минуту, не придумывает уроки", () => {
    const source = [lesson("now", "2026-11-17", "15:00")];
    expect(upcomingStudentHomeLessons("ivanov", source, "2026-11-17", "15:00")).toHaveLength(1);
    expect(upcomingStudentHomeLessons("ivanov", source, "2026-11-17", "15:01")).toEqual([]);
    expect(upcomingStudentHomeLessons("ivanov", [], "2026-11-17", "15:00")).toEqual([]);
  });
});
