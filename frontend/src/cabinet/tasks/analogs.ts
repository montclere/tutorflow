import type { Rich } from "../mocks/types";
import type { TaskItem } from "./types";

/** Повторяемый генератор случайных чисел — аналоги и тесты воспроизводимы. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Random = () => number;
const pick = <T>(random: Random, items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
const int = (random: Random, from: number, to: number) => from + Math.floor(random() * (to - from + 1));
const signed = (value: number) => (value < 0 ? `− ${-value}` : `+ ${value}`);
const decimal = (value: number) => String(Number(value.toFixed(4))).replace(".", ",");

type Generated = { statement: Rich; answer: string };

/**
 * Генераторы аналогов: новые числа, ответ считается тут же — поэтому он «проверен вычислением».
 * Для невычислимых предметов (русский, обществознание, английский) аналогов нет — только банк.
 */
const generators: Record<string, (random: Random) => Generated> = {
  "exp-eq": (random) => {
    const base = pick(random, [2, 3, 5]);
    const power = int(random, 2, base === 2 ? 6 : 4);
    const shift = int(random, -4, 4) || 1;
    return { statement: ["Найдите корень уравнения ", String(base), { sup: `x ${signed(shift)}` }, ` = ${base ** power}.`], answer: String(power - shift) };
  },
  "log-eq": (random) => {
    const base = pick(random, [2, 3, 5]);
    const power = int(random, 1, base === 2 ? 5 : 3);
    const shift = int(random, -6, 6) || 2;
    return { statement: ["Найдите корень уравнения log", { sub: String(base) }, `(x ${signed(shift)}) = ${power}.`], answer: String(base ** power - shift) };
  },
  "sqrt-eq": (random) => {
    const root = int(random, 2, 9);
    const shift = int(random, -10, 15) || 3;
    return { statement: [`Решите уравнение √(x ${signed(shift)}) = ${root}.`], answer: String(root * root - shift) };
  },
  "linear-eq": (random) => {
    const x = int(random, -9, 12);
    const a = pick(random, [2, 3, 4, 5, 6, 7]);
    const b = int(random, -20, 20) || 5;
    return { statement: [`Найдите корень уравнения ${a}x ${signed(b)} = ${a * x + b}.`], answer: String(x) };
  },
  "prob-simple": (random) => {
    const total = pick(random, [20, 25, 40, 50]);
    const good = int(random, 1, total - 1);
    return { statement: [`В коробке ${total} одинаковых на вид ручек, из них ${good} синих, остальные — чёрные. Найдите вероятность того, что случайно выбранная ручка окажется чёрной.`], answer: decimal((total - good) / total) };
  },
  "physics-speed": (random) => {
    const speed = pick(random, [4, 5, 8, 10, 12, 15, 20]);
    const time = int(random, 2, 12);
    return { statement: [`Тело движется равномерно со скоростью ${speed} м/с. Какой путь (в метрах) оно пройдёт за ${time} с?`], answer: String(speed * time) };
  },
  "info-image": (random) => {
    const width = pick(random, [64, 128, 256, 512]);
    const height = pick(random, [64, 128, 256]);
    const colors = pick(random, [4, 16, 256]);
    const bits = Math.log2(colors);
    return { statement: [`Растровое изображение ${width}×${height} пикселей использует палитру из ${colors} цветов. Сколько Кбайт займёт изображение без сжатия?`], answer: decimal((width * height * bits) / 8 / 1024) };
  },
};

export function canGenerate(task: Pick<TaskItem, "generator">): boolean {
  return task.generator !== undefined && task.generator in generators;
}

/** Аналоги задачи: те же номер, тема, баллы, новые числа, источник — «Аналог (ИИ)». */
export function makeAnalogs(task: TaskItem, count: number, seed: number): TaskItem[] {
  const generate = task.generator ? generators[task.generator] : undefined;
  if (!generate) return [];
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, index) => {
    const { statement, answer } = generate(random);
    return {
      ...task,
      id: `${task.id}-ai-${seed}-${index}`,
      source: "ai",
      sourceLabel: task.number !== undefined ? `Аналог №${task.number} · ИИ` : "Аналог · ИИ",
      statement,
      answer: { kind: "number", value: answer },
      solution: undefined,
      verified: true,
    };
  });
}
