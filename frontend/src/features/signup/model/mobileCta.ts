export type VisibilityChange = { id: string; visible: boolean };

/** Цели — элементы, при видимости которых плавающая кнопка лишняя: CTA первого экрана, форма, финальный призыв. */
export function applyVisibility(current: ReadonlySet<string>, changes: VisibilityChange[]): Set<string> {
  const next = new Set(current);
  for (const change of changes) {
    if (change.visible) next.add(change.id);
    else next.delete(change.id);
  }
  return next;
}

export function shouldShowMobileCta(visible: ReadonlySet<string>): boolean {
  return visible.size === 0;
}
