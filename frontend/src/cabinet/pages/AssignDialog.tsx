import { Search } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../content/cabinet.ru";
import { getSchedule, getStudents } from "../data";
import { canAssign, toggleSelected, type AssignMode, type RevealMode } from "../model/assign";
import { addDays } from "../model/dates";
import { filterStudents } from "../model/students";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { useNotifier } from "../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.tasks.assign;
const DEFAULT_DUE_DAYS = 7;

type Props = { open: boolean; onOpenChange: (open: boolean) => void; draftTitle: string };

function Field({ label, htmlFor, children }: { label: string; htmlFor?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-2">
      <label htmlFor={htmlFor} className="text-sm font-bold text-muted-foreground">
        {label}
      </label>
      {children}
    </div>
  );
}

function Choice<T extends string>({ label, value, items, onChange }: { label: string; value: T; items: readonly { id: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <ToggleGroup
      type="single"
      value={value}
      spacing={1}
      aria-label={label}
      className="w-full gap-1 rounded-lg border bg-card p-1"
      onValueChange={(next) => next && onChange(next as T)}
    >
      {items.map((item) => (
        <ToggleGroupItem key={item.id} value={item.id} className="flex-1 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
          {item.label}
        </ToggleGroupItem>
      ))}
    </ToggleGroup>
  );
}

function AssignForm({ draftTitle, onDone }: { draftTitle: string; onDone: () => void }) {
  const { notify } = useNotifier();
  const { today } = getSchedule();
  const students = filterStudents(getStudents(), { status: "active", query: "", debtorsOnly: false });
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [due, setDue] = useState(addDays(today, DEFAULT_DUE_DAYS));
  const [mode, setMode] = useState<AssignMode>("homework");
  const [reveal, setReveal] = useState<RevealMode>("afterCheck");
  const list = filterStudents(students, { status: "active", query, debtorsOnly: false });

  const submit = () => {
    notify(text.done(selected.length));
    onDone();
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black tracking-tight">{text.title}</DialogTitle>
        <DialogDescription>{text.description(draftTitle)}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-5">
        <Field label={text.studentsLabel} htmlFor="assign-search">
          <div className="relative">
            <Search size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="assign-search"
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={text.searchPlaceholder}
              aria-label={text.searchLabel}
              className="h-10 bg-card pl-9"
            />
          </div>
          <ul className="m-0 grid max-h-52 list-none gap-1 overflow-y-auto rounded-lg border p-1" aria-label={text.studentsLabel}>
            {list.length === 0 && <li className="px-3 py-4 text-center text-sm font-semibold text-muted-foreground">{text.noStudents}</li>}
            {list.map((student) => (
              <li key={student.id}>
                <label className="flex cursor-pointer items-center gap-3 rounded-md px-3 py-2 transition-colors duration-150 hover:bg-secondary has-[:checked]:bg-accent has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40 motion-reduce:transition-none">
                  <input
                    type="checkbox"
                    checked={selected.includes(student.id)}
                    onChange={() => setSelected((current) => toggleSelected(current, student.id))}
                    className="size-4 flex-none cursor-pointer accent-[var(--color-blue)] outline-none"
                  />
                  <Avatar initials={student.initials} color={student.color} />
                  <span className="min-w-0 flex-1">
                    <b className="block truncate text-base font-extrabold">{student.name}</b>
                    <span className="block truncate text-sm font-semibold text-muted-foreground">{student.goal}</span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field label={text.dueLabel} htmlFor="assign-due">
            <Input id="assign-due" type="date" value={due} min={today} onChange={(event) => setDue(event.target.value)} className="h-10 bg-card" />
          </Field>
          <Field label={text.modeLabel}>
            <Choice label={text.modeLabel} value={mode} items={text.modes} onChange={setMode} />
          </Field>
        </div>

        <Field label={text.revealLabel}>
          <Choice label={text.revealLabel} value={reveal} items={text.reveals} onChange={setReveal} />
        </Field>
      </div>

      <DialogFooter>
        <Button variant="primary" disabled={!canAssign(selected, due, today)} onClick={submit}>
          {text.submit}
        </Button>
      </DialogFooter>
    </>
  );
}

export function AssignDialog({ open, onOpenChange, draftTitle }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-xl">
        <AssignForm draftTitle={draftTitle} onDone={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
