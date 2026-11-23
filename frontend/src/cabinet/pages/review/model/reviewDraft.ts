import type { AiReview } from "../../../tasks/reviewAi";

export type AiState = { kind: "idle" } | { kind: "checking" } | { kind: "done"; review: AiReview } | { kind: "error" };
export type ReviewDraft = { points: number | null; comment: string; ai: AiState };
const empty: ReviewDraft = { points: null, comment: "", ai: { kind: "idle" } };

export function reviewDraftKey(assignmentId: string, attempt: number, taskId: string): string {
  return JSON.stringify([assignmentId, attempt, taskId]);
}

const drafts = new Map<string, ReviewDraft>();
const listeners = new Set<() => void>();
const emit = () => { for (const listener of listeners) listener(); };

export function getReviewDraft(key: string): ReviewDraft { return drafts.get(key) ?? empty; }
export function updateReviewDraft(key: string, patch: Partial<ReviewDraft>): void {
  drafts.set(key, { ...getReviewDraft(key), ...patch });
  emit();
}
export function clearReviewDraft(key: string): void { if (drafts.delete(key)) emit(); }
export function subscribeReviewDrafts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
