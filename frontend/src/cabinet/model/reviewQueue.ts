export function nextReviewIndex(current: number, length: number): number {
  return length === 0 ? 0 : (current + 1) % length;
}
