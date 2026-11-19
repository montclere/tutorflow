import type { AnswerResponse, AnswerSpec, TaskItem } from "./types";

export function emptyResponse(spec: AnswerSpec): AnswerResponse {
  switch (spec.kind) {
    case "number":
      return { kind: "number", value: "" };
    case "text":
      return { kind: "text", value: "" };
    case "choice":
      return { kind: "choice", selected: [] };
    case "match":
      return { kind: "match", pairs: spec.left.map(() => null) };
    case "extended":
      return { kind: "extended", photos: [] };
  }
}

/** Ответ дан: есть текст, выбран вариант, все пары соединены или приложено фото. */
export function isAnswered(response: AnswerResponse | undefined): boolean {
  if (!response) return false;
  switch (response.kind) {
    case "number":
    case "text":
      return response.value.trim() !== "";
    case "choice":
      return response.selected.length > 0;
    case "match":
      return response.pairs.every((pair) => pair !== null);
    case "extended":
      return response.photos.length > 0;
  }
}

/** Число из ответа ученика: запятая или точка, разные минусы и пробелы — одно и то же. */
export function parseNumber(value: string): number | null {
  const normalized = value.trim().replace(/\s+/g, "").replace(/[−–—]/g, "-").replace(",", ".");
  if (!/^[-+]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return null;
  return Number(normalized);
}

/** Текстовый ответ: регистр, «ё», пробелы и знаки по краям не важны (как в бланке ЕГЭ). */
export function normalizeText(value: string): string {
  return value.toLowerCase().replace(/ё/g, "е").replace(/[\s.,;:!?«»"']+/g, "");
}

const EPSILON = 1e-9;

/** true/false — проверено автоматически; null — развёрнутый ответ, проверяет репетитор. */
export function checkAnswer(spec: AnswerSpec, response: AnswerResponse): boolean | null {
  switch (spec.kind) {
    case "number": {
      if (response.kind !== "number") return false;
      const given = parseNumber(response.value);
      const expected = parseNumber(spec.value);
      return given !== null && expected !== null && Math.abs(given - expected) < EPSILON;
    }
    case "text":
      return response.kind === "text" && spec.values.some((value) => normalizeText(value) === normalizeText(response.value));
    case "choice": {
      if (response.kind !== "choice") return false;
      const given = [...new Set(response.selected)].sort();
      const expected = [...spec.correct].sort();
      return given.length === expected.length && given.every((value, index) => value === expected[index]);
    }
    case "match":
      return response.kind === "match" && spec.pairs.length === response.pairs.length && spec.pairs.every((value, index) => response.pairs[index] === value);
    case "extended":
      return null;
  }
}

/** В тест попадают только задачи с автопроверкой и проверенным ответом (TASKS-2). */
export function isAutoChecked(task: Pick<TaskItem, "answer" | "verified">): boolean {
  return task.answer.kind !== "extended" && task.verified;
}

/** Правильный ответ строкой — для черновика, разбора и листа ответов. */
export function answerText(spec: AnswerSpec): string {
  switch (spec.kind) {
    case "number":
      return spec.value;
    case "text":
      return spec.values.join(" / ");
    case "choice":
      return spec.correct.map((index) => index + 1).join("");
    case "match":
      return spec.pairs.map((index) => index + 1).join("");
    case "extended":
      return spec.criteria;
  }
}

/** Примерное время решения: короткий ответ — 3 минуты, развёрнутый — 12, по сложности. */
export function estimateMinutes(tasks: Pick<TaskItem, "answer" | "difficulty">[]): number {
  return tasks.reduce((sum, task) => sum + (task.answer.kind === "extended" ? 12 : 2 + task.difficulty), 0);
}
