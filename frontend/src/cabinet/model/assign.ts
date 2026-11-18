export type AssignMode = "homework" | "test";
export type RevealMode = "now" | "afterDue" | "afterCheck";

export function toggleSelected(selected: string[], id: string): string[] {
  return selected.includes(id) ? selected.filter((item) => item !== id) : [...selected, id];
}

/** Назначить можно, когда выбран хотя бы один ученик и срок не раньше сегодняшнего дня. */
export function canAssign(selected: string[], due: string, today: string): boolean {
  return selected.length > 0 && due !== "" && due >= today;
}
