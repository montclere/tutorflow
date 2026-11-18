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
