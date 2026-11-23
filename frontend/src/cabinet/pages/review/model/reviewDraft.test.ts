import { describe, expect, it } from "vitest";
import { getLibrary } from "../../../tasks/library";
import { clearReviewDraft, getReviewDraft, reviewDraftKey, subscribeReviewDrafts, updateReviewDraft } from "./reviewDraft";

describe("REVIEW-UI-1: черновик проверки", () => {
  it("сохраняет балл и комментарий при переключении работ и не переносит их в новую попытку", () => {
    const key = reviewDraftKey("draft-a", 10, "essay");
    updateReviewDraft(key, { points: 5, comment: "Уточните вывод" });
    expect(getReviewDraft(reviewDraftKey("draft-b", 10, "essay")).points).toBeNull();
    expect(getReviewDraft(reviewDraftKey("draft-a", 11, "essay")).comment).toBe("");
    expect(getReviewDraft(key)).toMatchObject({ points: 5, comment: "Уточните вывод" });
    clearReviewDraft(key);
  });
  it("предложение ИИ и сохранение черновика не публикуют оценку", () => {
    const before = getLibrary();
    const key = reviewDraftKey("a-demo-3", 10, "ru-oge-9-1");
    updateReviewDraft(key, { ai: { kind: "done", review: { score: 5, max: 6, summary: "Пример", checks: [] } } });
    expect(getReviewDraft(key).points).toBeNull();
    updateReviewDraft(key, { points: 5 });
    expect(getReviewDraft(key).points).toBe(5);
    expect(getLibrary()).toBe(before);
    expect(getLibrary().assignments.find((a) => a.id === "a-demo-3")?.status).toBe("wait");
    clearReviewDraft(key);
  });
  it("обновляет подписчика, сохраняет стабильный снимок и очищает только нужную задачу", () => {
    const key = reviewDraftKey("draft-c", 10, "essay");
    let changes = 0;
    const off = subscribeReviewDrafts(() => { changes += 1; });
    updateReviewDraft(key, { comment: "Первый комментарий" });
    expect(changes).toBe(1);
    expect(getReviewDraft(key)).toBe(getReviewDraft(key));
    updateReviewDraft("other", { comment: "Сохранён" });
    clearReviewDraft(key);
    expect(getReviewDraft(key)).toMatchObject({ points: null, comment: "", ai: { kind: "idle" } });
    expect(getReviewDraft("other").comment).toBe("Сохранён");
    off();
    clearReviewDraft("other");
  });
});
