import { attemptScore, canStart, type Assignment, type AttemptScore, type Work } from "../tasks/library";

export type StudentAssignmentEntry = { assignment: Assignment; work: Work; overdue: boolean; startable: boolean; score: AttemptScore | null };

/** STUDENT-TASKS-UI-2: проекция выдач, не меняющая библиотеку и правила попыток. */
export function studentAssignmentsOverview(studentId: string, assignments: Assignment[], works: Work[], today: string) {
  const order = { todo: 0, wait: 1, done: 2 };
  const entries: StudentAssignmentEntry[] = assignments.flatMap((assignment) => {
    const work = works.find((item) => item.id === assignment.workId);
    if (assignment.studentId !== studentId || !work) return [];
    const last = assignment.attempts.at(-1);
    return [{ assignment, work, overdue: assignment.status === "todo" && assignment.due < today, startable: canStart(assignment, work), score: last && assignment.status === "done" ? attemptScore(work.items, last.results) : null }];
  }).sort((a, b) => order[a.assignment.status] - order[b.assignment.status] || a.assignment.due.localeCompare(b.assignment.due));
  const active = entries.filter((item) => item.assignment.status !== "done");
  return {
    entries,
    leading: active.slice(0, 2),
    active: active.length,
    notStarted: entries.filter((item) => item.assignment.status === "todo" && item.assignment.attempts.length === 0).length,
    deadline: entries.find((item) => item.assignment.status === "todo")?.assignment.due ?? null,
  };
}
