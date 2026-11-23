import { BarChart3, CalendarDays, CheckCheck, ChevronDown, Clock, ClockAlert, Hourglass, Zap, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../../../app/router";
import { teacherRoutes } from "../../../../config/routes";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails } from "../../../data";
import type { AssignedTask, Student, Tone } from "../../../mocks/types";
import { formatShortDate } from "../../../model/dates";
import { homeworkSummary, taskPercent, taskStats, weakTopics } from "../../../model/studentTasks";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { Pill } from "../../../ui/Pill";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { Empty } from "./parts";
import styles from "./student-tabs.module.css";

const old = cabinet.teacher.students.sheet.tasks;
const text = cabinet.teacher.students.profile.tasks;
const GOOD_PERCENT = 80;
const BAD_PERCENT = 50;

type Filter = "all" | AssignedTask["status"];

const statusTones: Record<AssignedTask["status"], Tone> = { todo: "warn", wait: "blue", done: "ok" };
const statusIcons = { todo: Clock, wait: Hourglass, done: CheckCheck } as const;
const statusTiles: Record<AssignedTask["status"], string> = {
  todo: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
  wait: "bg-[var(--cab-blue-soft)] text-primary",
  done: "bg-[var(--cab-ok-soft)] text-success",
};

function scoreTone(percent: number): Tone {
  if (percent >= GOOD_PERCENT) return "ok";
  return percent < BAD_PERCENT ? "bad" : "warn";
}

function percentClass(percent: number | null): string {
  if (percent === null) return "";
  return percent >= GOOD_PERCENT ? "text-success" : percent < BAD_PERCENT ? "text-destructive" : "text-[var(--cab-warn)]";
}

function Meta({ task }: { task: AssignedTask }) {
  const parts = [old.assignedOn(formatShortDate(task.assignedAt))];
  if (task.submittedAt) parts.push(old.submittedOn(formatShortDate(task.submittedAt)));
  else if (task.due) parts.push(old.dueOn(formatShortDate(task.due)));
  if (task.timeMin) parts.push(old.spent(task.timeMin));
  return <span className="text-sm font-semibold text-muted-foreground tabular-nums">{parts.join(" · ")}</span>;
}

function TaskDetails({ task }: { task: AssignedTask }) {
  if (task.status === "todo") return <p className="m-0 text-sm font-semibold text-muted-foreground">{old.notStarted}</p>;
  if (task.status === "wait") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm font-semibold">{old.waitHint}</p>
        <Button variant="primary" size="sm" onClick={() => navigate(teacherRoutes.review)}>
          {old.check}
        </Button>
      </div>
    );
  }
  if (task.mistakes.length === 0) return <p className="m-0 text-sm font-bold text-success">{old.noMistakes}</p>;
  return (
    <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
      {task.mistakes.map((mistake) => (
        <li key={mistake.number} className="grid gap-2 rounded-xl bg-white/70 p-3">
          <b className="text-sm font-extrabold">{old.mistake.topic(mistake.number, mistake.topic)}</b>
          <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
            <span className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">{old.mistake.answer}</span>
              <b className="font-extrabold text-destructive tabular-nums">{mistake.answer}</b>
            </span>
            <span className="grid gap-0.5">
              <span className="text-xs text-muted-foreground">{old.mistake.correct}</span>
              <b className="font-extrabold text-success tabular-nums">{mistake.correct}</b>
            </span>
          </div>
        </li>
      ))}
    </ul>
  );
}

function TaskItem({ task, id }: { task: AssignedTask; id: string }) {
  const [open, setOpen] = useState(false);
  const percent = task.score ? taskPercent(task.score) : null;
  const Icon = statusIcons[task.status];
  return (
    <li className={styles.taskItem}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className={styles.taskRow}
      >
        <span className={cx(styles.taskStatusIcon, statusTiles[task.status])} aria-hidden="true">
          <Icon size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <b className={styles.taskTitle}>{task.title}</b>
          <Meta task={task} />
        </span>
        {task.score && percent !== null ? (
          <Pill tone={scoreTone(percent)}>{`${percent}% · ${old.score(task.score.correct, task.score.total)}`}</Pill>
        ) : (
          <Pill tone={statusTones[task.status]}>{old.status[task.status]}</Pill>
        )}
        <ChevronDown size={18} className={cx("flex-none text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className={styles.taskDetails}>
          <TaskDetails task={task} />
        </div>
      )}
    </li>
  );
}

function Figure({ icon: Icon, label, value, className, tone }: { icon: LucideIcon; label: string; value: string; className?: string; tone: "purple" | "blue" | "pink" }) {
  return <div className={styles.taskFigure}>
    <span className={`${styles.figureIcon} ${styles[tone]}`}><Icon aria-hidden="true" /></span>
    <div><span>{label}</span><b className={className}>{value}</b></div>
  </div>;
}

/** Полноширинный мониторинг ученика с прежними расчётами и обработчиками. */
export function TasksTab({ student, today }: { student: Student; today: string }) {
  const { tasks, trainer } = getStudentDetails(student.id);
  const [filter, setFilter] = useState<Filter>("all");
  const stats = taskStats(tasks);
  const summary = homeworkSummary(tasks, today);
  const topics = weakTopics(tasks).slice(0, 4);
  const shown = filter === "all" ? tasks : tasks.filter((task) => task.status === filter);

  return <div className={styles.tasksLayout}>
    <div className={styles.taskFigures} role="region" aria-label={text.summaryLabel}>
      <Figure icon={BarChart3} tone="purple" label={text.kpi.average} value={stats.percent === null ? old.stats.none : `${stats.percent}%`} className={percentClass(stats.percent)} />
      <Figure icon={CalendarDays} tone="blue" label={text.kpi.onTime} value={summary.onTime === null ? old.stats.none : `${summary.onTime}%`} />
      <Figure icon={Hourglass} tone="purple" label={text.kpi.wait} value={String(summary.wait)} className={summary.wait > 0 ? "text-primary" : undefined} />
      <Figure icon={ClockAlert} tone="pink" label={text.kpi.overdue} value={String(summary.overdue)} className={summary.overdue > 0 ? "text-destructive" : undefined} />
    </div>
    <section className={`${styles.panel} ${styles.weakStrip}`} aria-label={text.weakTitle}>
      <span className={`${styles.figureIcon} ${styles.purple}`}><Zap aria-hidden="true" /></span>
      <div><div className={styles.weakTopics}><b>{text.weakChips}</b>{topics.length > 0 ? topics.map((topic) => <span key={topic.topic}>{topic.topic} · {topic.count}</span>) : <p>{text.noWeakData}</p>}</div><p className={styles.trainer}>{trainer ? text.trainerLine(trainer.solvedWeek, trainer.accuracy, trainer.weak) : text.noTrainer}</p></div>
    </section>
    <section className={`${styles.panel} ${styles.tasksPanel}`}>
      <header className={styles.tasksHeader}><h3>{text.listTitle}</h3>
        <ToggleGroup type="single" spacing={1} value={filter} aria-label={text.filterLabel} className={styles.taskFilters} onValueChange={(value) => value && setFilter(value as Filter)}>
          {(Object.keys(text.filters) as Filter[]).map((id) => <ToggleGroupItem key={id} value={id}>{text.filters[id]}</ToggleGroupItem>)}
        </ToggleGroup>
      </header>
      {shown.length === 0 ? <Empty>{tasks.length === 0 ? old.empty : text.empty}</Empty> : <ul className={styles.tasksList}>{shown.map((task, index) => <TaskItem key={`${task.title}-${task.assignedAt}`} id={`task-${student.id}-${index}`} task={task} />)}</ul>}
    </section>
  </div>;
}
