import { ClipboardList, FileDown, Zap } from "lucide-react";
import { useState } from "react";
import { getSchedule } from "../../data";
import { demoStudentId } from "../../mocks/student";
import { formatShortDate } from "../../model/dates";
import { attemptScore, canStart, useLibrary, type Assignment, type Work } from "../../tasks/library";
import { tasksText } from "../../tasks/tasks.ru";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { Pill } from "../../ui/Pill";
import { TaskPlayer } from "./player/TaskPlayer";

const text = tasksText.student;

type Props = { onPrint?: (work: Work, assignment: Assignment) => void };

/** Выданное репетитором в кабинете ученика: начать, ещё попытка, результат (TASKS-8). */
export function StudentAssignments({ onPrint }: Props) {
  const { works, assignments } = useLibrary();
  const { today } = getSchedule();
  const [open, setOpen] = useState<Assignment | null>(null);
  const mine = assignments.filter((assignment) => assignment.studentId === demoStudentId);
  const workOf = (id: string) => works.find((work) => work.id === id);
  const current = open ? (assignments.find((assignment) => assignment.id === open.id) ?? null) : null;

  return (
    <section className="mb-5 grid gap-3" aria-label={text.title}>
      <div>
        <h2 className="m-0 font-[family-name:var(--font-display)] text-lg font-extrabold">{text.title}</h2>
        <p className="m-0 text-sm font-semibold text-muted-foreground">{text.subtitle}</p>
      </div>
      {mine.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed bg-card p-6 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 min-[821px]:grid-cols-2">
          {mine.map((assignment) => {
            const work = workOf(assignment.workId);
            if (!work) return null;
            const last = assignment.attempts.at(-1);
            const score = last ? attemptScore(work.items, last.results) : null;
            const startable = canStart(assignment, work);
            const attemptsLeft = work.kind === "test" && work.test?.attempts ? work.test.attempts - assignment.attempts.length : null;
            const overdue = assignment.status === "todo" && assignment.due < today;
            return (
              <li key={assignment.id} className="grid content-between gap-4 rounded-2xl border bg-card p-5">
                <div className="flex items-start gap-3">
                  <span className={cx("grid size-11 flex-none place-items-center rounded-xl", work.kind === "test" ? "bg-highlight text-highlight-foreground" : "bg-accent text-accent-foreground")} aria-hidden="true">
                    {work.kind === "test" ? <Zap size={20} /> : <ClipboardList size={20} />}
                  </span>
                  <div className="grid min-w-0 flex-1 gap-1">
                    <b className="text-base font-extrabold">{work.title}</b>
                    <span className="text-sm font-semibold text-muted-foreground tabular-nums">
                      {tasksText.kinds[work.kind]}
                      {work.kind === "test" && work.test ? ` · ${tasksText.save.modes[work.test.mode]}` : ""} · {tasksText.count(work.items.length)} ·{" "}
                      <span className={overdue ? "font-bold text-destructive" : undefined}>{overdue ? text.overdue : text.due(formatShortDate(assignment.due))}</span>
                    </span>
                    {attemptsLeft !== null && assignment.attempts.length > 0 && <span className="text-xs font-bold text-muted-foreground">{text.attemptsLeft(Math.max(0, attemptsLeft))}</span>}
                  </div>
                  {score?.percent !== null && score && assignment.status === "done" ? (
                    <b className="font-[family-name:var(--font-display)] text-2xl font-black tabular-nums">{score.percent}%</b>
                  ) : (
                    <Pill tone={assignment.status === "wait" ? "blue" : assignment.status === "done" ? "ok" : "warn"}>{text.status[assignment.status]}</Pill>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {startable && (
                    <Button variant="primary" icon={work.kind === "test" ? Zap : undefined} onClick={() => setOpen(assignment)}>
                      {assignment.attempts.length > 0 ? text.again : text.start[work.kind]}
                    </Button>
                  )}
                  {work.kind === "homework" && onPrint && (
                    <Button icon={FileDown} onClick={() => onPrint(work, assignment)}>
                      {text.print}
                    </Button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <TaskPlayer assignment={current} work={current ? (workOf(current.workId) ?? null) : null} onClose={() => setOpen(null)} />
    </section>
  );
}
