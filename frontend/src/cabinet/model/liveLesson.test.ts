import { describe, expect, it } from "vitest";
import { attemptKey, liveDraftErrors, type LiveDraft } from "./liveLesson";

const draft: LiveDraft = { cardId: "c1", title: "Дроби", date: "2026-11-20", start: "17:00", durationMin: 60, repeat: false, count: 8 };

describe("liveDraftErrors", () => {
  it("полный черновик без ошибок", () => {
    expect(liveDraftErrors(draft, "2026-11-19", "12:00")).toEqual([]);
  });

  it("ученик, тема, прошедшее время, длительность и число уроков серии", () => {
    expect(liveDraftErrors({ ...draft, cardId: null, title: " ", date: "2026-11-19", start: "11:00", durationMin: 300, repeat: true, count: 30 }, "2026-11-19", "12:00")).toEqual([
      "student",
      "topic",
      "past",
      "duration",
      "count",
    ]);
  });
});

describe("attemptKey", () => {
  it("те же данные — тот же ключ, другие — новый", () => {
    let n = 0;
    const next = () => `k${++n}`;
    const first = attemptKey(null, "a", next);
    expect(attemptKey(first, "a", next).key).toBe("k1");
    expect(attemptKey(first, "b", next).key).toBe("k2");
  });
});

describe("проведённый задним числом (LES-43)", () => {
  const base = { cardId: "c1", title: "Тема", date: "2026-11-10", start: "10:00", durationMin: 60, repeat: false, count: 8 };
  it("прошедшее время допустимо только для записи проведённого урока", () => {
    expect(liveDraftErrors({ ...base, recorded: true }, "2026-11-17", "14:00")).toEqual([]);
    expect(liveDraftErrors(base, "2026-11-17", "14:00")).toEqual(["past"]);
    expect(liveDraftErrors({ ...base, recorded: true, date: "2026-11-20" }, "2026-11-17", "14:00")).toEqual(["future"]);
  });
});
