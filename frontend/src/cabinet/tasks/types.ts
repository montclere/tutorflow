import type { Rich } from "../mocks/types";

/**
 * Задача — единый формат для всех предметов: банк, ИИ, свои задачи, задания и тесты (ADR интерфейса, TASKS-*).
 * Предмет и экзамен — поля задачи; номера и темы берутся из каталога экзамена.
 */

export type SubjectId = "math" | "russian" | "physics" | "informatics" | "social" | "english";
export type ExamId = string;

export type ExamNumberInfo = { number: number; topic: string };
export type ExamInfo = { id: ExamId; subject: SubjectId; label: string; numbers: ExamNumberInfo[] };
export type SubjectInfo = { id: SubjectId; label: string; /** Можно ли ИИ менять числа в задаче и проверять ответ вычислением. */ computable: boolean };

/** Тип ответа. Всё, кроме развёрнутого, проверяется автоматически. */
export type AnswerSpec =
  | { kind: "number"; value: string }
  | { kind: "text"; values: string[] }
  | { kind: "choice"; options: string[]; correct: number[] }
  | { kind: "match"; left: string[]; right: string[]; pairs: number[] }
  | { kind: "extended"; criteria: string };

export type AnswerKind = AnswerSpec["kind"];

export type TaskSource = "fipi" | "demo" | "ai" | "own";
export type Difficulty = 1 | 2 | 3;

export type TaskItem = {
  id: string;
  subject: SubjectId;
  exam?: ExamId;
  /** Номер в экзамене; у задач без экзамена — нет. */
  number?: number;
  topic: string;
  difficulty: Difficulty;
  source: TaskSource;
  /** «ФИПИ · открытый банк», «Демоверсия 2026», «Аналог №6»… */
  sourceLabel: string;
  statement: Rich;
  answer: AnswerSpec;
  solution?: string;
  points: number;
  /** Ответ проверен: у задач банка — всегда, у ИИ — если проверен вычислением. */
  verified: boolean;
  /** Генератор аналогов (для вычислимых предметов). */
  generator?: string;
};

/** Ответ ученика в том же виде, что и тип ответа. */
export type AnswerResponse =
  | { kind: "number"; value: string }
  | { kind: "text"; value: string }
  | { kind: "choice"; selected: number[] }
  | { kind: "match"; pairs: (number | null)[] }
  | { kind: "extended"; photos: string[] };
