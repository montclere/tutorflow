import { Check, ClipboardList, Search, Zap } from "lucide-react";
import { useState } from "react";
import { getSchedule, getStudents } from "../../data";
import { addDays } from "../../model/dates";
import { filterStudents } from "../../model/students";
import { assignWork, useLibrary, type RevealMode, type Work } from "../../tasks/library";
import { tasksText } from "../../tasks/tasks.ru";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { Choice, Field } from "./Choice";

const text = tasksText.assign;
const DEFAULT_DUE_DAYS = 7;

export function workInfo(work: Work): string {
  const meta = `${tasksText.count(work.items.length)} · ${tasksText.points(work.items.reduce((sum, task) => sum + task.points, 0))}`;
  if (work.kind !== "test" || !work.test) return `${meta} · ${tasksText.save.formats[work.format ?? "online"]}`;
  const save = tasksText.save;
  return `${meta} · ${text.testInfo(save.modes[work.test.mode], work.test.timeLimitMin === null ? save.noTime : save.minutes(work.test.timeLimitMin), work.test.attempts === null ? "∞" : String(work.test.attempts))}`;
}

function WorkPicker({ onPick }: { onPick: (work: Work) => void }) {
  const { works } = useLibrary();
  if (works.length === 0) return <p className="m-0 rounded-xl border border-dashed p-6 text-center text-sm font-semibold text-muted-foreground">{text.pickWorkEmpty}</p>;
  return (
    <ul className="m-0 grid max-h-[50dvh] list-none gap-2 overflow-y-auto p-0" aria-label={text.pickWork}>
      {works.map((work) => (
        <li key={work.id}>
          <button
            type="button"
            onClick={() => onPick(work)}
            className="flex w-full appearance-none items-center gap-3 rounded-xl border border-border bg-card p-3 text-left text-foreground [font-family:inherit] transition-colors hover:border-primary"
          >
            <span className={cx("grid size-9 flex-none place-items-center rounded-lg", work.kind === "test" ? "bg-highlight text-highlight-foreground" : "bg-accent text-accent-foreground")} aria-hidden="true">
              {work.kind === "test" ? <Zap size={16} /> : <ClipboardList size={16} />}
            </span>
            <span className="grid min-w-0 flex-1">
              <b className="truncate text-sm font-extrabold">{work.title}</b>
              <span className="truncate text-xs font-semibold text-muted-foreground">
                {tasksText.kinds[work.kind]} · {workInfo(work)}
              </span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function AssignForm({ work, studentId, onBack, onDone }: { work: Work; studentId?: string; onBack?: () => void; onDone: () => void }) {
  const { notify } = useNotifier();
  const { today } = getSchedule();
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>(studentId ? [studentId] : []);
  const [due, setDue] = useState(addDays(today, DEFAULT_DUE_DAYS));
  const [reveal, setReveal] = useState<RevealMode>(work.kind === "test" ? "now" : "afterCheck");
  const [tried, setTried] = useState(false);
  const students = filterStudents(getStudents(), { status: "active", query, debtorsOnly: false });
  const studentsError = tried && selected.length === 0;
  const dueError = tried && (due === "" || due < today);

  const submit = () => {
    setTried(true);
    if (selected.length === 0 || due === "" || due < today) return;
    assignWork(work.id, { studentIds: selected, due, reveal, today });
    notify(text.done(selected.length));
    onDone();
  };

  const toggle = (id: string) => setSelected((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <form
      className="grid gap-5"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">
          {text.title}: {work.title}
        </DialogTitle>
        <DialogDescription>
          {tasksText.kinds[work.kind]} · {workInfo(work)}
        </DialogDescription>
      </DialogHeader>
      {onBack && (
        <button type="button" onClick={onBack} className="w-fit appearance-none border-0 bg-transparent p-0 text-sm font-bold text-primary [font-family:inherit] hover:underline">
          {text.back}
        </button>
      )}

      <Field label={text.students}>
        <div className="relative">
          <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input type="search" value={query} placeholder={text.search} aria-label={text.search} className="pl-9" onChange={(event) => setQuery(event.target.value)} />
        </div>
        <ul className={cx("m-0 grid max-h-52 list-none gap-1 overflow-y-auto rounded-xl border p-1", studentsError && "border-destructive")} aria-label={text.students}>
          {students.length === 0 && <li className="p-3 text-sm font-semibold text-muted-foreground">{text.noStudents}</li>}
          {students.map((student) => {
            const on = selected.includes(student.id);
            return (
              <li key={student.id}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggle(student.id)}
                  className={cx("flex w-full appearance-none items-center gap-3 rounded-lg border-0 p-2 text-left text-foreground [font-family:inherit] transition-colors", on ? "bg-accent" : "bg-transparent hover:bg-secondary")}
                >
                  <Avatar initials={student.initials} color={student.color} />
                  <span className="grid min-w-0 flex-1">
                    <b className="truncate text-sm font-extrabold">{student.name}</b>
                    <span className="truncate text-xs font-semibold text-muted-foreground">{student.goal}</span>
                  </span>
                  <span className={cx("grid size-5 place-items-center rounded-md border", on ? "border-primary bg-primary text-primary-foreground" : "border-border")} aria-hidden="true">
                    {on && <Check size={13} />}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {studentsError && <span className="text-sm font-semibold text-destructive">{text.errorStudents}</span>}
      </Field>

      <div className="grid gap-4 sm:grid-cols-[auto_minmax(0,1fr)]">
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">{text.due}</span>
          <Input type="date" value={due} min={today} aria-invalid={dueError} onChange={(event) => setDue(event.target.value)} />
          {dueError && <span className="text-sm font-semibold text-destructive">{text.errorDue}</span>}
        </label>
        <Field label={text.reveal}>
          <Choice label={text.reveal} value={reveal} items={(["now", "afterDue", "afterCheck"] as const).map((id) => ({ id, label: text.reveals[id] }))} onChange={setReveal} />
        </Field>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" onClick={onDone}>
          {text.cancel}
        </Button>
        <Button type="submit" variant="primary">
          {text.submit}
          {selected.length > 0 ? ` · ${selected.length}` : ""}
        </Button>
      </DialogFooter>
    </form>
  );
}

type Props = { open: boolean; work?: Work | null; studentId?: string; onClose: () => void };

/** Одно окно выдачи для задания и теста; без выбранной работы — сначала выбор из «Моих заданий» (TASKS-6). */
export function AssignWorkDialog({ open, work, studentId, onClose }: Props) {
  const [picked, setPicked] = useState<Work | null>(null);
  const current = work ?? picked;
  const close = () => {
    setPicked(null);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        {current ? (
          <AssignForm key={current.id} work={current} studentId={studentId} onBack={work ? undefined : () => setPicked(null)} onDone={close} />
        ) : (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.title}</DialogTitle>
              <DialogDescription>{text.pickWork}</DialogDescription>
            </DialogHeader>
            <WorkPicker onPick={setPicked} />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
