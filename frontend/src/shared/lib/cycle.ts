export function cycleIndex(current: number, delta: number, length: number): number {
  return (((current + delta) % length) + length) % length;
}

/** Клавиши навигации по списку вкладок или шагов; null — клавиша не про навигацию. */
export function keyToIndex(key: string, current: number, length: number): number | null {
  switch (key) {
    case "ArrowRight":
    case "ArrowDown":
      return cycleIndex(current, 1, length);
    case "ArrowLeft":
    case "ArrowUp":
      return cycleIndex(current, -1, length);
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default:
      return null;
  }
}
