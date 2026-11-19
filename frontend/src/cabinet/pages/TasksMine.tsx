import { ChevronDown, ClipboardList, CopyPlus, FileDown, SendHorizontal, Trash2, Zap } from "lucide-react";
import { useState } from "react";
import { navigate } from "../../app/router";
import { teacherRoutes } from "../../config/routes";
import { getStudents } from "../data";
import { formatShortDate } from "../model/dates";
import { loadDraft } from "../tasks/draft";
import { attemptScore, removeWork, useLibrary, workAverage, type Work, type WorkKind } from "../tasks/library";
import { tasksText } from "../tasks/tasks.ru";
import { Avatar } from "../ui/Avatar";
import { Button, IconButton } from "../ui/Button";
import { cx } from "../ui/cx";
import { useNotifier } from "../ui/Notifications";
import { Pill } from "../ui/Pill";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { workInfo } from "./tasks/AssignWorkDialog";
import { DraftDock } from "./tasks/DraftDock";

const text = tasksText.mine;
type Filter = "all" | WorkKind;

function Results({ work }: { work: Work }) {
  const { assignments } = useLibrary();
  const students = getStudents();
  const list = assignments.filter((assignment) => assignment.workId === work.id);
  if (list.length === 0) return <p className="m-0 text-sm font-semibold text-muted-foreground">{text.resultsEmpty}</p>;
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {list.map((assignment) => {
        const student = students.find((item) => item.id === assignment.studentId);
        const last = assignment.attempts.at(-1);
        const score = last ? attemptScore(work.items, last.results) : null;
        return (
          <li key={assignment.id} className="flex flex-wrap items-center gap-3 rounded-lg px-2 py-2 hover:bg-secondary/60">
            {student && <Avatar initials={student.initials} color={student.color} />}
            <span className="grid min-w-0 flex-1">
              <b className="truncate text-sm font-extrabold">{student?.name ?? assignment.studentId}</b>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">{text.due(formatShortDate(assignment.due))}</span>
            </span>
            {score?.percent !== null && score !== null && assignment.status === "done" && <b className="font-[family-name:var(--font-display)] text-base font-extrabold tabular-nums">{text.score(score.percent ?? 0)}</b>}
            <Pill tone={assignment.status === "done" ? "ok" : assignment.status === "wait" ? "blue" : "warn"}>{text.status[assignment.status]}</Pill>
          </li>
        );
      })}
    </ul>
  );
}

function WorkRow({ work, onAssign, onPdf }: { work: Work; onAssign: (work: Work) => void; onPdf: (work: Work) => void }) {
  const { notify } = useNotifier();
  const { assignments } = useLibrary();
  const [open, setOpen] = useState(false);
  const assigned = assignments.filter((assignment) => assignment.workId === work.id).length;
  const average = workAverage(work.id);
  const resultsId = `results-${work.id}`;

  return (
    <li className="rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-4">
        <span className={cx("grid size-11 flex-none place-items-center rounded-xl", work.kind === "test" ? "bg-highlight text-highlight-foreground" : "bg-accent text-accent-foreground")} aria-hidden="true">
          {work.kind === "test" ? <Zap size={20} /> : <ClipboardList size={20} />}
        </span>
        <div className="grid min-w-0 flex-1 gap-0.5">
          <span className="flex flex-wrap items-center gap-2">
            <b className="text-base font-extrabold">{work.title}</b>
            <Pill tone={work.kind === "test" ? "lime" : "blue"}>{tasksText.kinds[work.kind]}</Pill>
          </span>
          <span className="text-sm font-semibold text-muted-foreground tabular-nums">{workInfo(work)}</span>
          <span className="text-xs font-bold text-muted-foreground tabular-nums">
            {text.assigned(assigned)}
            {average !== null && ` · ${text.average(average)}`} · {formatShortDate(work.createdAt)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" variant="primary" icon={SendHorizontal} onClick={() => onAssign(work)}>
            {text.assign}
          </Button>
          <Button size="sm" icon={FileDown} onClick={() => onPdf(work)}>
            {text.pdf}
          </Button>
          <Button
            size="sm"
            icon={CopyPlus}
            onClick={() => {
              loadDraft({ title: work.title, items: work.items });
              notify(text.toDraftDone);
              navigate(teacherRoutes.tasksCreate);
            }}
          >
            {text.toDraft}
          </Button>
          <Button size="sm" aria-expanded={open} aria-controls={resultsId} onClick={() => setOpen((current) => !current)}>
            {text.results}
            <ChevronDown size={14} className={cx("transition-transform", open && "rotate-180")} aria-hidden="true" />
          </Button>
          <IconButton
            icon={Trash2}
            label={text.remove(work.title)}
            onClick={() => {
              removeWork(work.id);
              notify(text.removed);
            }}
          />
        </div>
      </div>
      {open && (
        <div id={resultsId} className="border-t p-3">
          <Results work={work} />
        </div>
      )}
    </li>
  );
}

/** Сохранённые задания и тесты: выдать, PDF, взять в черновик, посмотреть результаты (TASKS-7). */
export function TasksMine({ onAssign, onPdf }: { onAssign: (work: Work) => void; onPdf: (work: Work) => void }) {
  const { works } = useLibrary();
  const [filter, setFilter] = useState<Filter>("all");
  const shown = filter === "all" ? works : works.filter((work) => work.kind === filter);

  return (
    <>
      <div className="mb-3">
        <ToggleGroup type="single" spacing={1} value={filter} aria-label={text.filterLabel} className="w-fit gap-1 rounded-lg border bg-card p-1" onValueChange={(value) => value && setFilter(value as Filter)}>
          {(Object.keys(text.filters) as Filter[]).map((id) => (
            <ToggleGroupItem key={id} value={id} className="h-7 px-3 text-sm data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              {text.filters[id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      {shown.length === 0 ? (
        <p className="m-0 rounded-2xl border border-dashed bg-card p-8 text-center text-sm font-semibold text-muted-foreground">{text.empty}</p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0">
          {shown.map((work) => (
            <WorkRow key={work.id} work={work} onAssign={onAssign} onPdf={onPdf} />
          ))}
        </ul>
      )}
      <DraftDock />
    </>
  );
}
