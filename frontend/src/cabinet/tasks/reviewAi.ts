import type { TaskItem } from "./types";

/**
 * Демо проверки развёрнутых ответов: «распознанное» фото решения и разбор ИИ по критериям задачи.
 * В рабочей версии фото распознаёт и оценивает модель на сервере — по нажатию репетитора, не сама.
 */

export type Solution = { lines: string[]; /** Строка с ошибкой — подсвечивается. */ mistake?: number };
export type AiCheck = { ok: boolean; text: string };
export type AiReview = { score: number; max: number; summary: string; checks: AiCheck[]; mistake?: number };

const solutions: Record<string, Solution> = {
  "orlova:bank-19": { lines: ["4ˣ − 5·2ˣ + 4 = 0", "Пусть t = 2ˣ, t > 0", "t² − 5t + 4 = 0", "t₁ = 1, t₂ = 4", "2ˣ = 1 → x = 0;  2ˣ = 4 → x = 2", "б) −1 ≤ 0 ≤ 3, −1 ≤ 2 ≤ 3", "Ответ: а) 0; 2  б) 0; 2"] },
  "volkova:bank-19": { lines: ["4ˣ − 5·2ˣ + 4 = 0", "t = 2ˣ", "t² − 5t + 4 = 0", "t = 1, t = 4", "x = 0, x = 2", "Ответ: 0; 2; −1"], mistake: 5 },
};

const reviews: Record<string, Omit<AiReview, "max">> = {
  "orlova:bank-19": {
    score: 2,
    summary: "Решение полное: замена с условием t > 0, оба корня и отбор на отрезке.",
    checks: [
      { ok: true, text: "Замена t = 2ˣ с условием t > 0" },
      { ok: true, text: "Корни квадратного уравнения найдены верно" },
      { ok: true, text: "Отбор корней на отрезке [−1; 3] выполнен" },
    ],
  },
  "volkova:bank-19": {
    score: 1,
    summary: "Пункт а) решён верно, но в ответ попал лишний корень −1 и нет отбора для пункта б).",
    checks: [
      { ok: true, text: "Замена и корни квадратного уравнения" },
      { ok: false, text: "Нет условия t > 0 при замене" },
      { ok: false, text: "Пункт б): отбор корней не выполнен, в ответе лишний −1" },
    ],
    mistake: 5,
  },
};

export function solutionOf(studentId: string, taskId: string, photos: string[]): Solution {
  return solutions[`${studentId}:${taskId}`] ?? { lines: photos.map((photo) => `Фото: ${photo}`) };
}

/** Разбор ИИ: если для решения нет уверенной оценки — честно просит проверить вручную (score = −1). */
export function aiReview(studentId: string, task: TaskItem): AiReview {
  const found = reviews[`${studentId}:${task.id}`];
  if (found) return { ...found, max: task.points };
  return { score: -1, max: task.points, summary: "Не удалось уверенно разобрать почерк — проверьте вручную по критериям.", checks: [] };
}
