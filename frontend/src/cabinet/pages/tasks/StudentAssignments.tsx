import { CheckCheck, ClipboardList, FileDown, Hourglass, Zap } from "lucide-react";
import { useState } from "react";
import { getSchedule } from "../../data";
import { demoStudentId } from "../../mocks/student";
import { formatShortDate } from "../../model/dates";
import { attemptScore, canStart, useLibrary, type Assignment, type AssignmentStatus, type Work } from "../../tasks/library";
import { tasksText } from "../../tasks/tasks.ru";
import { cx } from "../../ui/cx";
import { chunky } from "../learn/chunky";
import styles from "../learn/learn.module.css";
import { Ring } from "../learn/Ring";
import { TaskPlayer } from "./player/TaskPlayer";

const text = tasksText.student;
const groupIcons = { todo: Zap, wait: Hourglass, done: CheckCheck } as const;

type Props = { onPrint?: (work: Work, assignment: Assignment) => void };

function AssignmentCard({ assignment, work, index, onOpen, onPrint }: { assignment: Assignment; work: Work; index: number; onOpen: () => void; onPrint?: Props["onPrint"] }) {
  const { today } = getSchedule();
  const last = assignment.attempts.at(-1);
  const score = last ? attemptScore(work.items, last.results) : null;
  const startable = canStart(assignment, work);
  const overdue = assignment.status === "todo" && assignment.due < today;
  const test = work.kind === "test";
  const Icon = test ? Zap : ClipboardList;

  return (
    <li className={cx("grid content-between gap-4 rounded-3xl border-2 bg-card p-5", styles.rise, assignment.status === "todo" && "border-primary/30")} style={{ "--delay": `${index * 70}ms` } as React.CSSProperties}>
      <div className="flex items-start gap-4">
        <span
          className={cx(
            "grid size-16 flex-none place-items-center rounded-full",
            test ? "bg-highlight text-highlight-foreground shadow-[0_5px_0_color-mix(in_srgb,var(--color-lime)_55%,#000)]" : "bg-primary text-primary-foreground shadow-[0_5px_0_color-mix(in_srgb,var(--color-blue)_60%,#000)]",
            assignment.status === "todo" && index === 0 && styles.float,
            assignment.status !== "todo" && "opacity-80",
          )}
          aria-hidden="true"
        >
          <Icon size={28} />
        </span>
        <div className="grid min-w-0 flex-1 gap-1">
          <b className="text-lg leading-snug font-extrabold">{work.title}</b>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">
            {tasksText.kinds[work.kind]}
            {test && work.test ? ` · ${tasksText.save.modes[work.test.mode]}` : ""} · {text.tasksCount(work.items.length)}
          </span>
          <span className={cx("text-sm font-bold tabular-nums", overdue ? "text-destructive" : "text-muted-foreground")}>{overdue ? text.overdue : text.due(formatShortDate(assignment.due))}</span>
        </div>
        {score?.percent !== null && score && assignment.status === "done" && (
          <Ring value={score.percent ?? 0} size={64} stroke={8} tone={(score.percent ?? 0) >= 80 ? "var(--color-success, #16a34a)" : "var(--color-blue)"} label={`${score.percent}%`}>
            <b className="text-sm font-black tabular-nums">{score.percent}%</b>
          </Ring>
        )}
      </div>
      {assignment.status === "todo" && assignment.returned && <p className="m-0 rounded-2xl bg-[var(--cab-warn-soft)] px-3 py-2 text-sm font-semibold">{text.returned(assignment.returned)}</p>}
      {assignment.status === "done" && assignment.feedback && Object.values(assignment.feedback).length > 0 && (
        <p className="m-0 rounded-2xl bg-[var(--cab-lime-soft)] px-3 py-2 text-sm font-semibold">
          <b>{text.feedback}:</b> {Object.values(assignment.feedback).join(" ")}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {startable && (
          <button type="button" className={chunky(test ? "lime" : "primary")} onClick={onOpen}>
            {test && <Zap size={18} aria-hidden="true" />}
            {assignment.attempts.length > 0 ? text.again : text.start[work.kind]}
          </button>
        )}
        {work.kind === "homework" && onPrint && assignment.status === "todo" && (
          <button type="button" className={chunky("ghost")} onClick={() => onPrint(work, assignment)}>
            <FileDown size={18} aria-hidden="true" />
            {text.print}
          </button>
        )}
      </div>
    </li>
  );
}

/** Выданное репетитором: «Сейчас», «На проверке», «Готово» — яркие карточки и объёмные кнопки (STUDENT-4, TASKS-8). */
export function StudentAssignments({ onPrint }: Props) {
  const { works, assignments } = useLibrary();
  const [open, setOpen] = useState<Assignment | null>(null);
  const mine = assignments.filter((assignment) => assignment.studentId === demoStudentId);
  const workOf = (id: string) => works.find((work) => work.id === id);
  const current = open ? (assignments.find((assignment) => assignment.id === open.id) ?? null) : null;

  return (
    <div className="grid gap-6">
      {(["todo", "wait", "done"] as AssignmentStatus[]).map((status) => {
        const list = mine.filter((assignment) => assignment.status === status);
        const GroupIcon = groupIcons[status];
        if (status !== "todo" && list.length === 0) return null;
        return (
          <section key={status} className="grid gap-3" aria-label={text.groups[status]}>
            <h2 className="m-0 flex items-center gap-2 font-[family-name:var(--font-display)] text-lg font-extrabold">
              <GroupIcon size={20} className={status === "todo" ? "text-primary" : "text-muted-foreground"} aria-hidden="true" />
              {text.groups[status]}
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-extrabold text-muted-foreground tabular-nums">{list.length}</span>
            </h2>
            {list.length === 0 ? (
              <p className="m-0 rounded-3xl border-2 border-dashed bg-card p-6 text-center text-sm font-semibold text-muted-foreground">{text.groupEmpty[status]}</p>
            ) : (
              <ul className="m-0 grid list-none gap-4 p-0 min-[821px]:grid-cols-2">
                {list.map((assignment, index) => {
                  const work = workOf(assignment.workId);
                  return work ? <AssignmentCard key={assignment.id} assignment={assignment} work={work} index={index} onOpen={() => setOpen(assignment)} onPrint={onPrint} /> : null;
                })}
              </ul>
            )}
          </section>
        );
      })}
      <TaskPlayer assignment={current} work={current ? (workOf(current.workId) ?? null) : null} onClose={() => setOpen(null)} />
    </div>
  );
}
