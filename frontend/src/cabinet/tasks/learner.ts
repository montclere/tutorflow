import { getStudentDetails } from "../data";
import { useStudents } from "../data/useStudents";
import { homeworkTimeline } from "../model/studentTasks";
import { getLibrary, useLibrary } from "./library";
import { practiceEvidence, usePractice } from "./practice";
import { mergeEvidence, studentProgress, unitKey, type Evidence, type StudentGoal, type StudentProgress } from "./progress";

/** Цели учеников (в рабочей версии — из карточки ученика): экзамен или темы программы. */
export const goals: Record<string, StudentGoal> = {
  ivanov: { kind: "exam", exam: "ege-math-profile", daysLeft: 191 },
  smirnova: { kind: "exam", exam: "oge-math", daysLeft: 197 },
  orlova: { kind: "exam", exam: "oge-math", daysLeft: 197 },
  volkova: { kind: "exam", exam: "ege-math-profile", daysLeft: 191 },
  petrov: { kind: "topics", subject: "math", title: "Алгебра · 10 класс", topics: ["Тождества", "Радианы", "Тригонометрия", "Уравнения", "Степени"] },
  sokolov: { kind: "exam", exam: "oge-math", daysLeft: 197 },
};

const tally = (level: number) => [{ correct: 3, total: 10 }, { correct: 5, total: 10 }, { correct: 7, total: 10 }, { correct: 9, total: 10 }][level] ?? { correct: 0, total: 0 };

/** Стартовые данные — история до подключения TutorFlow (в рабочей версии — с сервера). */
const baseEvidence: Record<string, Evidence> = {
  ivanov: Object.fromEntries([3, 3, 3, 3, 3, 3, 3, 2, 2, 2, 1, 1, 0, 0, 0, 0].map((level, index) => [`n:${index + 1}`, tally(level)])),
  petrov: { "t:Тождества": tally(1), "t:Радианы": tally(2), "t:Тригонометрия": tally(0), "t:Степени": tally(3) },
};

/** Проверенные ответы в заданиях и тестах — тоже данные прогресса. */
function libraryEvidence(studentId: string, goal: StudentGoal): Evidence {
  const { works, assignments } = getLibrary();
  const evidence: Evidence = {};
  for (const assignment of assignments) {
    if (assignment.studentId !== studentId) continue;
    const work = works.find((item) => item.id === assignment.workId);
    const last = assignment.attempts.at(-1);
    if (!work || !last) continue;
    for (const task of work.items) {
      const result = last.results[task.id];
      const key = unitKey(goal, task);
      if (!key || !result || result.correct === null) continue;
      const current = evidence[key] ?? { correct: 0, total: 0 };
      evidence[key] = { correct: current.correct + Number(result.correct), total: current.total + 1 };
    }
  }
  return evidence;
}

export function progressOf(studentId: string): StudentProgress | null {
  const goal = goals[studentId];
  if (!goal) return null;
  const practice = goal.kind === "exam" ? practiceEvidence(goal.exam) : {};
  return studentProgress(goal, mergeEvidence(baseEvidence[studentId] ?? {}, libraryEvidence(studentId, goal), practice), homeworkTimeline(getStudentDetails(studentId).tasks));
}

/** Прогресс с подпиской: обновляется после ответа в тренажёре, проверки работы или новой выдачи. */
export function useStudentProgress(studentId: string): StudentProgress | null {
  usePractice();
  useLibrary();
  useStudents();
  return progressOf(studentId);
}
