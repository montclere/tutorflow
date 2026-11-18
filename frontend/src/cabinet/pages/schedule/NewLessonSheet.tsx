import { AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { addLessons, getStudent, getStudents } from "../../data";
import { useSchedule } from "../../data/useSchedule";
import type { LessonType, ScheduleLesson } from "../../mocks/types";
import { formatDayMonth, formatShortDate, weekdayIndex } from "../../model/dates";
import {
  buildLessons,
  defaultStart,
  draftDates,
  draftErrors,
  findConflicts,
  MAX_DURATION_MIN,
  MIN_DURATION_MIN,
  schoolYearEnd,
  TIME_STEP_MIN,
  type DraftError,
  type LessonDraft,
} from "../../model/newLesson";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Button as KitButton } from "@/shared/ui/kit/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/shared/ui/kit/command";
import { Input } from "@/shared/ui/kit/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/shared/ui/kit/popover";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/kit/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.schedule.create;
const types = cabinet.teacher.schedule.types;
const DEFAULT_DURATION = 60;
const MAX_CONFLICTS_SHOWN = 2;

/** repeatWeekly — сразу с повтором по дню недели (например, «Назначить расписание» в карточке ученика). */
export type NewLessonSeed = Partial<Pick<LessonDraft, "studentId" | "date" | "start">> & { repeatWeekly?: boolean };

type Props = {
  seed: NewLessonSeed | null;
  onClose: () => void;
  onCreated?: (lessons: ScheduleLesson[]) => void;
};

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">
        {label}
        {hint && <span className="font-semibold"> · {hint}</span>}
      </span>
      {children}
    </div>
  );
}

function StudentPicker({ value, onChange }: { value: string | null; onChange: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const students = getStudents().filter((student) => student.status === "active");
  const selected = students.find((student) => student.id === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <KitButton variant="secondary" role="combobox" aria-expanded={open} aria-label={text.student} className="w-full justify-between">
          <span className="flex min-w-0 items-center gap-2">
            {selected && <Avatar initials={selected.initials} color={selected.color} />}
            <span className={cx("truncate", !selected && "text-muted-foreground")}>{selected ? selected.name : text.chooseStudent}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="text-muted-foreground" />
        </KitButton>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
        <Command>
          <CommandInput placeholder={text.searchStudent} />
          <CommandList>
            <CommandEmpty>{text.noStudents}</CommandEmpty>
            <CommandGroup>
              {students.map((student) => (
                <CommandItem
                  key={student.id}
                  value={student.name}
                  onSelect={() => {
                    onChange(student.id);
                    setOpen(false);
                  }}
                >
                  <Check aria-hidden="true" className={cx(value === student.id ? "opacity-100" : "opacity-0")} />
                  <Avatar initials={student.initials} color={student.color} />
                  <span className="truncate">{student.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function joinDays(indexes: number[]): string {
  const names = [...indexes].sort((a, b) => a - b).map((index) => cabinet.weekdays[index] ?? "");
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} ${text.and} ${names.at(-1)}`;
}

function durationOf(studentId: string | null | undefined): number {
  if (!studentId) return DEFAULT_DURATION;
  return getStudent(studentId).schedule.durationMin || DEFAULT_DURATION;
}

function initialDraft(seed: NewLessonSeed, today: string, now: string, work: Parameters<typeof defaultStart>[0]): LessonDraft {
  const date = seed.date && seed.date >= today ? seed.date : today;
  return {
    studentId: seed.studentId ?? null,
    date,
    start: seed.start ?? defaultStart(work, date, today, now),
    durationMin: durationOf(seed.studentId),
    type: "individual",
    repeat: seed.repeatWeekly ? { kind: "weekly", weekdays: [weekdayIndex(date)], until: schoolYearEnd(date) } : { kind: "none" },
    link: "",
  };
}

/** Форма живёт, пока панель открыта; новое открытие — новый черновик (ключ в родителе не нужен). */
function NewLessonForm({ seed, onClose, onCreated }: { seed: NewLessonSeed; onClose: () => void; onCreated?: Props["onCreated"] }) {
  const { notify } = useNotifier();
  const schedule = useSchedule();
  const [draft, setDraft] = useState(() => initialDraft(seed, schedule.today, schedule.now, schedule.work));
  const [durationTouched, setDurationTouched] = useState(false);
  const [customDuration, setCustomDuration] = useState(false);
  const [triedSubmit, setTriedSubmit] = useState(false);

  const update = (patch: Partial<LessonDraft>) => setDraft((current) => ({ ...current, ...patch }));

  const candidates = useMemo(() => buildLessons(draft, "draft"), [draft]);
  const conflicts = useMemo(() => findConflicts(candidates, schedule.lessons), [candidates, schedule.lessons]);
  const errors = draftErrors(draft, schedule.today, schedule.now);
  // Ученика подсвечиваем только после попытки создать, остальные ошибки видны сразу.
  const shownErrors = errors.filter((error) => error !== "student" || triedSubmit);
  const count = draft.studentId ? candidates.length : draftDates(draft).length;

  const pickStudent = (studentId: string) => update({ studentId, ...(durationTouched ? {} : { durationMin: durationOf(studentId) }) });

  const setRepeat = (kind: "none" | "weekly") => {
    if (kind === "none") return update({ repeat: { kind: "none" } });
    update({ repeat: { kind: "weekly", weekdays: [weekdayIndex(draft.date)], until: schoolYearEnd(draft.date) } });
  };

  const submit = () => {
    setTriedSubmit(true);
    if (errors.length > 0) return;
    const lessons = buildLessons(draft, `new-${Date.now()}`);
    addLessons(lessons);
    notify(text.created(lessons.length));
    onCreated?.(lessons);
    onClose();
  };

  const summary =
    draft.repeat.kind === "weekly"
      ? text.summarySeries(joinDays(draft.repeat.weekdays), draft.start, count, formatDayMonth(draft.repeat.until))
      : text.summaryOne(formatDayMonth(draft.date), draft.start, draft.durationMin);

  const errorText = (error: DraftError) => text.errors[error];

  return (
    <>
      <SheetHeader className="pr-12">
        <SheetTitle className="m-0 font-[family-name:var(--font-display)] text-lg font-black">{text.title}</SheetTitle>
        <SheetDescription className="sr-only">{summary}</SheetDescription>
      </SheetHeader>

      <div className="grid gap-5 px-4 pb-4">
        <Field label={text.student}>
          <StudentPicker value={draft.studentId} onChange={pickStudent} />
        </Field>

        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
          <Field label={text.date}>
            <Input type="date" value={draft.date} min={schedule.today} aria-label={text.date} onChange={(event) => event.target.value && update({ date: event.target.value })} />
          </Field>
          <Field label={text.time}>
            <Input
              type="time"
              step={TIME_STEP_MIN * 60}
              value={draft.start}
              aria-label={text.time}
              onChange={(event) => event.target.value && update({ start: event.target.value })}
            />
          </Field>
        </div>

        <Field label={text.duration}>
          <div className="flex flex-wrap items-center gap-2">
            <ToggleGroup
              type="single"
              spacing={1}
              value={customDuration ? "custom" : String(draft.durationMin)}
              aria-label={text.duration}
              className="gap-1 rounded-lg border bg-card p-1"
              onValueChange={(value) => {
                if (!value) return;
                setDurationTouched(true);
                if (value === "custom") return setCustomDuration(true);
                setCustomDuration(false);
                update({ durationMin: Number(value) });
              }}
            >
              {text.durations.map((minutes) => (
                <ToggleGroupItem key={minutes} value={String(minutes)} className="px-3 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                  {minutes}
                </ToggleGroupItem>
              ))}
              <ToggleGroupItem value="custom" className="px-3 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                {text.customDuration}
              </ToggleGroupItem>
            </ToggleGroup>
            {customDuration && (
              <span className="flex items-center gap-2">
                <Input
                  type="number"
                  inputMode="numeric"
                  min={MIN_DURATION_MIN}
                  max={MAX_DURATION_MIN}
                  step={5}
                  value={draft.durationMin}
                  aria-label={text.minutesLabel}
                  className="w-20"
                  onChange={(event) => update({ durationMin: Number(event.target.value) || 0 })}
                />
                <span className="text-sm font-semibold text-muted-foreground">{text.minutesShort}</span>
              </span>
            )}
          </div>
        </Field>

        <Field label={text.repeat}>
          <ToggleGroup
            type="single"
            spacing={1}
            value={draft.repeat.kind}
            aria-label={text.repeat}
            className="w-full gap-1 rounded-lg border bg-card p-1"
            onValueChange={(value) => value && setRepeat(value as "none" | "weekly")}
          >
            {text.repeatModes.map((mode) => (
              <ToggleGroupItem key={mode.id} value={mode.id} className="flex-1 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                {mode.label}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {draft.repeat.kind === "weekly" && (
            <div className="mt-2 grid gap-3">
              <ToggleGroup
                type="multiple"
                spacing={1}
                value={draft.repeat.weekdays.map(String)}
                aria-label={text.weekdaysLabel}
                className="w-full gap-1"
                onValueChange={(values) => draft.repeat.kind === "weekly" && update({ repeat: { ...draft.repeat, weekdays: values.map(Number) } })}
              >
                {cabinet.weekdays.map((day, index) => (
                  <ToggleGroupItem
                    key={day}
                    value={String(index)}
                    className="flex-1 rounded-md border bg-card px-0 data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    {day}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              <label className="flex items-center gap-3">
                <span className="text-sm font-bold text-muted-foreground">{text.until}</span>
                <Input
                  type="date"
                  value={draft.repeat.until}
                  min={draft.date}
                  aria-label={text.until}
                  onChange={(event) => event.target.value && draft.repeat.kind === "weekly" && update({ repeat: { ...draft.repeat, until: event.target.value } })}
                />
              </label>
            </div>
          )}
        </Field>

        <Field label={text.type}>
          <ToggleGroup
            type="single"
            spacing={1}
            value={draft.type}
            aria-label={text.type}
            className="w-full gap-1 rounded-lg border bg-card p-1"
            onValueChange={(value) => value && update({ type: value as LessonType })}
          >
            {(Object.keys(types) as LessonType[]).map((type) => (
              <ToggleGroupItem key={type} value={type} className="flex-1 px-2 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
                {types[type]}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>

        <Field label={text.link} hint={text.optional}>
          <Input type="url" inputMode="url" value={draft.link} placeholder={text.linkPlaceholder} aria-label={text.link} onChange={(event) => update({ link: event.target.value })} />
        </Field>

        {conflicts.length > 0 && (
          <div className="grid gap-1.5 rounded-xl bg-[var(--cab-warn-soft)] p-3 text-sm" role="status">
            <b className="flex items-center gap-2 font-extrabold text-[var(--cab-warn)]">
              <AlertTriangle size={16} aria-hidden="true" />
              {text.conflictsTitle}
            </b>
            <ul className="m-0 grid list-none gap-0.5 p-0 font-semibold">
              {conflicts.slice(0, MAX_CONFLICTS_SHOWN).map(({ existing }) => (
                <li key={existing.id}>{text.conflict(getStudent(existing.studentId).name, formatShortDate(existing.date), existing.start)}</li>
              ))}
              {conflicts.length > MAX_CONFLICTS_SHOWN && <li>{text.conflictsMore(conflicts.length - MAX_CONFLICTS_SHOWN)}</li>}
            </ul>
            <span className="text-xs font-semibold text-muted-foreground">{text.conflictsNote}</span>
          </div>
        )}
      </div>

      <SheetFooter className="sticky bottom-0 mt-auto gap-3 border-t bg-background">
        <div className="grid gap-0.5">
          <span className="text-xs font-bold text-muted-foreground">{text.summaryTitle}</span>
          <b className="text-sm font-extrabold">{summary}</b>
        </div>
        {shownErrors.length > 0 && (
          <ul className="m-0 grid list-none gap-0.5 p-0 text-sm font-semibold text-[var(--color-error)]" role="alert">
            {shownErrors.map((error) => (
              <li key={error}>{errorText(error)}</li>
            ))}
          </ul>
        )}
        <Button variant="primary" onClick={submit}>
          {text.submit(Math.max(count, 1))}
        </Button>
      </SheetFooter>
    </>
  );
}

export function NewLessonSheet({ seed, onClose, onCreated }: Props) {
  return (
    <Sheet open={seed !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {seed && <NewLessonForm seed={seed} onClose={onClose} onCreated={onCreated} />}
      </SheetContent>
    </Sheet>
  );
}
