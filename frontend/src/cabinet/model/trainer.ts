import type { Unit } from "../tasks/progress";

/** STUDENT-TRAINER-UI-2: доступные темы, сначала требующие повторения. */
export function trainerRecommendations(units: Unit[], available: ReadonlySet<number>): (Unit & { number: number })[] {
  return units
    .filter((unit): unit is Unit & { number: number } => unit.number !== undefined && available.has(unit.number))
    .sort((a, b) => Number(a.total === 0) - Number(b.total === 0) || (a.total > 0 && b.total > 0 ? a.correct / a.total - b.correct / b.total : 0))
    .slice(0, 3);
}
