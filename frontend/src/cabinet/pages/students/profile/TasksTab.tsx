import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../../../app/router";
import { teacherRoutes } from "../../../../config/routes";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails } from "../../../data";
import type { AssignedTask, Student, Tone } from "../../../mocks/types";
import { formatShortDate } from "../../../model/dates";
import { homeworkSummary, homeworkTimeline, taskPercent, taskStats, weakTopics } from "../../../model/studentTasks";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { Pill } from "../../../ui/Pill";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { Empty, Kpi, Panel } from "./parts";
import { ResultBars } from "./ResultBars";

const old = cabinet.teacher.students.sheet.tasks;
const text = cabinet.teacher.students.profile.tasks;
const GOOD_PERCENT = 80;
const BAD_PERCENT = 50;

type Filter = "all" | AssignedTask["status"];

const statusTones: Record<AssignedTask["status"], Tone> = { todo: "warn", wait: "blue", done: "ok" };

function scoreTone(percent: number): Tone {
  if (percent >= GOOD_PERCENT) return "ok";
  return percent < BAD_PERCENT ? "bad" : "warn";
}

function Meta({ task }: { task: AssignedTask }) {
  const parts = [old.assignedOn(formatShortDate(task.assignedAt))];
  if (task.submittedAt) parts.push(old.submittedOn(formatShortDate(task.submittedAt)));
  else if (task.due) parts.push(old.dueOn(formatShortDate(task.due)));
  if (task.timeMin) parts.push(old.spent(task.timeMin));
  return <span className="text-sm font-semibold text-muted-foreground tabular-nums">{parts.join(" · ")}</span>;
}

function TaskDetails({ task }: { task: AssignedTask }) {
  if (task.status === "todo") return <p className="m-0 text-base font-semibold text-muted-foreground">{old.notStarted}</p>;
  if (task.status === "wait") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-base font-semibold">{old.waitHint}</p>
        <Button variant="primary" size="sm" onClick={() => navigate(teacherRoutes.review)}>
          {old.check}
        </Button>
      </div>
    );
  }
  if (task.mistakes.length === 0) return <p className="m-0 text-base font-bold text-success">{old.noMistakes}</p>;
  return (
    <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
      {task.mistakes.map((mistake) => (
        <li key={mistake.number} className="grid gap-2 rounded-xl bg-secondary/70 p-3.5">
          <b className="text-sm font-extrabold">{old.mistake.topic(mistake.number, mistake.topic)}</b>
          <div className="grid grid-cols-2 gap-3 text-sm font-semibold">
            <span className="grid gap-0.5">
              <span className="text-muted-foreground">{old.mistake.answer}</span>
              <b className="text-base font-extrabold text-destructive tabular-nums">{mistake.answer}</b>
            </span>
            <span className="grid gap-0.5">
              <span className="text-muted-foreground">{old.mistake.correct}</span>
              <b className="text-base font-extrabold text-success tabular-nums">{mistake.correct}</b>
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
  return (
    <li>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full cursor-pointer appearance-none items-center gap-3 rounded-lg border-0 bg-transparent px-0 py-3 text-left text-inherit [font:inherit] outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
      >
        <span className="min-w-0 flex-1">
          <b className="block text-base font-extrabold">{task.title}</b>
          <Meta task={task} />
        </span>
        {task.mistakes.length > 0 && <span className="text-sm font-bold whitespace-nowrap text-muted-foreground max-[520px]:hidden">{text.mistakes(task.mistakes.length)}</span>}
        {task.score && percent !== null ? (
          <Pill tone={scoreTone(percent)}>{`${percent}% · ${old.score(task.score.correct, task.score.total)}`}</Pill>
        ) : (
          <Pill tone={statusTones[task.status]}>{old.status[task.status]}</Pill>
        )}
        <ChevronDown size={18} className={cx("flex-none text-muted-foreground transition-transform duration-200 motion-reduce:transition-none", open && "rotate-180")} aria-hidden="true" />
      </button>
      {open && (
        <div id={id} className="pb-4">
          <TaskDetails task={task} />
        </div>
      )}
    </li>
  );
}

/** Мониторинг домашек: результаты, сроки, слабые темы и разбор ошибок по каждому заданию. */
export function TasksTab({ student, today }: { student: Student; today: string }) {
  const { tasks, trainer } = getStudentDetails(student.id);
  const [filter, setFilter] = useState<Filter>("all");
  const stats = taskStats(tasks);
  const summary = homeworkSummary(tasks, today);
  const points = homeworkTimeline(tasks);
  const topics = weakTopics(tasks);
  const maxTopic = topics[0]?.count ?? 1;
  const shown = filter === "all" ? tasks : tasks.filter((task) => task.status === filter);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi
          label={text.kpi.average}
          value={stats.percent === null ? old.stats.none : `${stats.percent}%`}
          note={summary.trend === null ? undefined : text.trend(summary.trend)}
          tone={stats.percent === null ? undefined : stats.percent >= GOOD_PERCENT ? "good" : stats.percent < BAD_PERCENT ? "bad" : "warn"}
        />
        <Kpi label={text.kpi.onTime} value={summary.onTime === null ? old.stats.none : `${summary.onTime}%`} />
        <Kpi label={text.kpi.wait} value={String(summary.wait)} />
        <Kpi label={text.kpi.overdue} value={String(summary.overdue)} tone={summary.overdue > 0 ? "bad" : undefined} />
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Panel title={text.chartTitle} hint={text.chartHint}>
          {points.length === 0 ? <Empty>{cabinet.teacher.students.profile.overview.progressEmpty}</Empty> : <ResultBars points={points} />}
        </Panel>
        <Panel title={text.weakTitle} hint={text.weakHint}>
          {topics.length === 0 ? (
            <Empty>{text.weakEmpty}</Empty>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {topics.map((topic) => (
                <li key={topic.topic} className="grid gap-1.5">
                  <span className="flex items-baseline justify-between gap-3 text-sm">
                    <b className="min-w-0 truncate font-bold">{topic.topic}</b>
                    <span className="font-bold whitespace-nowrap text-muted-foreground tabular-nums">{text.mistakes(topic.count)}</span>
                  </span>
                  <span className="h-2 overflow-hidden rounded-full bg-secondary" aria-hidden="true">
                    <span className="block h-full rounded-full bg-primary" style={{ width: `${(topic.count / maxTopic) * 100}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel
        title={text.listTitle}
        action={
          <ToggleGroup
            type="single"
            spacing={1}
            value={filter}
            aria-label={text.filterLabel}
            className="flex-wrap gap-1 rounded-lg border bg-card p-1"
            onValueChange={(value) => value && setFilter(value as Filter)}
          >
            {(Object.keys(text.filters) as Filter[]).map((id) => (
              <ToggleGroupItem key={id} value={id} className="h-7 px-2.5 text-sm data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                {text.filters[id]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        }
      >
        {shown.length === 0 ? (
          <Empty>{tasks.length === 0 ? old.empty : text.empty}</Empty>
        ) : (
          <ul className="m-0 list-none divide-y divide-border p-0">
            {shown.map((task, index) => (
              <TaskItem key={`${task.title}-${task.assignedAt}`} id={`task-${student.id}-${index}`} task={task} />
            ))}
          </ul>
        )}
      </Panel>

      <Panel title={old.trainer}>
        {trainer ? (
          <div className="grid grid-cols-3 gap-3 max-[520px]:grid-cols-1">
            <Kpi label={text.trainer.solved} value={String(trainer.solvedWeek)} />
            <Kpi label={text.trainer.accuracy} value={`${trainer.accuracy}%`} />
            <Kpi label={text.trainer.weak} value={trainer.weak} />
          </div>
        ) : (
          <Empty>{old.noTrainer}</Empty>
        )}
      </Panel>
    </div>
  );
}
