import type { ExamInfo, SubjectId, SubjectInfo } from "./types";

export const subjects: SubjectInfo[] = [
  { id: "math", label: "Математика", computable: true },
  { id: "physics", label: "Физика", computable: true },
  { id: "informatics", label: "Информатика", computable: true },
  { id: "russian", label: "Русский язык", computable: false },
  { id: "social", label: "Обществознание", computable: false },
  { id: "english", label: "Английский язык", computable: false },
];

const n = (pairs: [number, string][]) => pairs.map(([number, topic]) => ({ number, topic }));

export const exams: ExamInfo[] = [
  {
    id: "ege-math-profile",
    subject: "math",
    label: "ЕГЭ профиль",
    numbers: n([
      [1, "Планиметрия"],
      [2, "Векторы"],
      [3, "Стереометрия"],
      [4, "Вероятность"],
      [5, "Вероятность+"],
      [6, "Уравнения"],
      [7, "Выражения"],
      [8, "Производная"],
      [9, "Прикладные"],
      [10, "Текстовые"],
      [11, "Графики"],
      [12, "Экстремумы"],
      [13, "Уравнения+"],
      [15, "Неравенства"],
      [16, "Экономика"],
    ]),
  },
  {
    id: "oge-math",
    subject: "math",
    label: "ОГЭ",
    numbers: n([
      [6, "Вычисления"],
      [7, "Числовая прямая"],
      [8, "Степени и корни"],
      [9, "Уравнения"],
      [10, "Вероятность"],
      [11, "Графики функций"],
      [12, "Формулы"],
      [15, "Треугольники"],
    ]),
  },
  {
    id: "ege-russian",
    subject: "russian",
    label: "ЕГЭ",
    numbers: n([
      [4, "Ударения"],
      [5, "Паронимы"],
      [9, "Корни"],
      [10, "Приставки"],
      [16, "Пунктуация"],
      [27, "Сочинение"],
    ]),
  },
  {
    id: "ege-physics",
    subject: "physics",
    label: "ЕГЭ",
    numbers: n([
      [1, "Кинематика"],
      [2, "Динамика"],
      [3, "Законы сохранения"],
      [6, "Анализ процессов"],
      [24, "Задача с решением"],
    ]),
  },
  {
    id: "ege-informatics",
    subject: "informatics",
    label: "ЕГЭ",
    numbers: n([
      [1, "Графы"],
      [5, "Алгоритмы"],
      [7, "Кодирование изображений"],
      [11, "Объём информации"],
    ]),
  },
  {
    id: "ege-social",
    subject: "social",
    label: "ЕГЭ",
    numbers: n([
      [1, "Понятия"],
      [3, "Выбор суждений"],
      [5, "Соответствие"],
      [25, "Развёрнутый ответ"],
    ]),
  },
  {
    id: "oge-english",
    subject: "english",
    label: "ОГЭ",
    numbers: n([
      [20, "Грамматика"],
      [30, "Словообразование"],
      [38, "Письмо"],
    ]),
  },
];

export function subjectOf(id: SubjectId): SubjectInfo {
  return subjects.find((subject) => subject.id === id) ?? { id, label: id, computable: false };
}

export function examOf(id: string | undefined): ExamInfo | undefined {
  return exams.find((exam) => exam.id === id);
}

export function examsOf(subject: SubjectId): ExamInfo[] {
  return exams.filter((exam) => exam.subject === subject);
}

/** «Математика · ЕГЭ профиль · №6». */
export function taskPlace(task: { subject: SubjectId; exam?: string; number?: number }): string {
  const exam = examOf(task.exam);
  return [subjectOf(task.subject).label, exam?.label, task.number !== undefined ? `№${task.number}` : null].filter(Boolean).join(" · ");
}
