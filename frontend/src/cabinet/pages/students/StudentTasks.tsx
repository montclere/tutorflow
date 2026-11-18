import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import { getStudentDetails } from "../../data";
import type { AssignedTask, Student, Tone } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { taskPercent, taskStats } from "../../model/studentTasks";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { Pill } from "../../ui/Pill";
import { StudentEmpty, StudentSection } from "./StudentSection";

const text = cabinet.teacher.students.sheet.tasks;

const GOOD_PERCENT = 80;
const BAD_PERCENT = 50;

const statusTones: Record<AssignedTask["status"], Tone> = { todo: "warn", wait: "blue", done: "ok" };

function scoreTone(percent: number): Tone {
  if (percent >= GOOD_PERCENT) return "ok";
  return percent < BAD_PERCENT ? "bad" : "warn";
}

function Stat({ label, value, compact }: { label: string; value: string; compact?: boolean }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-2xl border bg-card p-4">
      <span className="text-sm font-bold text-muted-foreground">{label}</span>
      <b className={cx("font-[family-name:var(--font-display)] leading-snug font-extrabold tabular-nums", compact ? "text-base" : "text-lg")}>{value}</b>
    </div>
  );
}

function Meta({ task }: { task: AssignedTask }) {
  const parts = [text.assignedOn(formatShortDate(task.assignedAt))];
  if (task.submittedAt) parts.push(text.submittedOn(formatShortDate(task.submittedAt)));
  else if (task.due) parts.push(text.dueOn(formatShortDate(task.due)));
  if (task.timeMin) parts.push(text.spent(task.timeMin));
  return <span className="text-sm font-semibold text-muted-foreground tabular-nums">{parts.join(" · ")}</span>;
}

function TaskDetails({ task }: { task: AssignedTask }) {
  if (task.status === "todo") {
    return <p className="m-0 text-base font-semibold text-muted-foreground">{text.notStarted}</p>;
  }
  if (task.status === "wait") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-base font-semibold">{text.waitHint}</p>
        <Button variant="primary" size="sm" onClick={() => navigate(teacherRoutes.review)}>
          {text.check}
        </Button>
      </div>
    );
  }
  if (task.mistakes.length === 0) {
    return <p className="m-0 text-base font-bold text-success">{text.noMistakes}</p>;
  }
  return (
    <div className="grid gap-2.5">
      <h4 className="m-0 text-sm font-bold text-muted-foreground">{text.mistakes}</h4>
      <ul className="m-0 grid list-none gap-2 p-0">
        {task.mistakes.map((mistake) => (
          <li key={mistake.number} className="grid gap-2 rounded-xl bg-secondary/70 p-3.5">
            <b className="text-base font-extrabold">{text.mistake.topic(mistake.number, mistake.topic)}</b>
            <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
              <span className="grid gap-0.5">
                <span className="text-muted-foreground">{text.mistake.answer}</span>
                <b className="text-base font-extrabold text-destructive tabular-nums">{mistake.answer}</b>
              </span>
              <span className="grid gap-0.5">
                <span className="text-muted-foreground">{text.mistake.correct}</span>
                <b className="text-base font-extrabold text-success tabular-nums">{mistake.correct}</b>
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function TaskItem({ task, id, initiallyOpen }: { task: AssignedTask; id: string; initiallyOpen: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  const percent = task.score ? taskPercent(task.score) : null;

  return (
    <li className="py-1">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer items-center gap-3 rounded-lg border-0 bg-transparent px-0 py-2 text-left outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <span className="min-w-0 flex-1">
          <b className="block text-base font-extrabold">{task.title}</b>
          <Meta task={task} />
        </span>
        {task.score && percent !== null ? (
          <Pill tone={scoreTone(percent)}>{text.score(task.score.correct, task.score.total)}</Pill>
        ) : (
          <Pill tone={statusTones[task.status]}>{text.status[task.status]}</Pill>
        )}
        <ChevronDown size={18} className={cx("flex-none text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="pb-3">
          <TaskDetails task={task} />
        </div>
      )}
    </li>
  );
}

export function TasksTab({ student }: { student: Student }) {
  const { tasks, trainer } = getStudentDetails(student.id);
  const stats = taskStats(tasks);
  const firstWithMistakes = tasks.findIndex((task) => task.mistakes.length > 0);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {stats.checked > 0 && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <Stat label={text.stats.average} value={stats.percent === null ? text.stats.none : `${stats.percent}%`} />
          <Stat label={text.stats.mistakes} value={String(stats.mistakes)} />
          <div className="col-span-2 sm:col-span-1">
            <Stat compact label={text.stats.weakTopic} value={stats.topTopic ?? text.stats.none} />
          </div>
        </div>
      )}
      <StudentSection title={text.assigned}>
        {tasks.length === 0 ? (
          <StudentEmpty text={text.empty} />
        ) : (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {tasks.map((task, index) => (
              <TaskItem key={task.title} id={`task-${student.id}-${index}`} task={task} initiallyOpen={index === firstWithMistakes} />
            ))}
          </ul>
        )}
      </StudentSection>
      <StudentSection title={text.trainer}>
        {trainer ? (
          <div className="grid gap-1 text-base font-semibold tabular-nums">
            <span>{text.solved(trainer.solvedWeek)}</span>
            <span>{text.accuracy(trainer.accuracy)}</span>
            <span className="text-muted-foreground">{text.weak(trainer.weak)}</span>
          </div>
        ) : (
          <StudentEmpty text={text.noTrainer} />
        )}
      </StudentSection>
    </div>
  );
}
