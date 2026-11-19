import { AlertTriangle, Check, ChevronsUpDown } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { addLessons, getStudent, getStudents } from "../../data";
import { useSchedule } from "../../data/useSchedule";
import type { LessonType, ScheduleLesson } from "../../mocks/types";
import { addDays, formatDayMonth, formatShortDate, weekdayIndex } from "../../model/dates";
import { formatRubles } from "../../model/format";
import { upcomingFreeWindows } from "../../model/freeSlots";
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
    <div className="grid gap-2">
      <span className="text-sm font-bold text-foreground/75">
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
        <KitButton variant="secondary" role="combobox" aria-expanded={open} aria-label={text.student} className="h-14 w-full justify-between rounded-xl text-base">
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

/** Блок формы: номер шага и заголовок, внутри — поля на стеклянной подложке (VIBE-16). */
function Block({ step, title, children }: { step: number; title: string; children: ReactNode }) {
  return (
    <section className="glass grid gap-4 rounded-2xl p-4">
      <h3 className="m-0 flex items-center gap-2.5 font-[family-name:var(--font-display)] text-base font-extrabold">
        <span className="grid size-7 place-items-center rounded-lg bg-primary text-sm font-black text-primary-foreground tabular-nums">{step}</span>
        {title}
      </h3>
      {children}
    </section>
  );
}

const big = "h-12 rounded-xl text-base md:text-base";
const toggleItem = "h-10 text-base font-bold data-[state=on]:bg-accent data-[state=on]:text-accent-foreground";

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
  const student = draft.studentId ? getStudent(draft.studentId) : null;
  const usualTime = student && /^\d{2}:\d{2}$/.test(student.schedule.time) ? student.schedule.time : null;
  const quickDates = Array.from({ length: 7 }, (_, index) => addDays(schedule.today, index));
  const windows = upcomingFreeWindows(schedule.lessons, [draft.date], schedule.work, schedule.today, schedule.now);

  return (
    <>
      <SheetHeader className="gap-1 pr-12">
        <SheetTitle className="m-0 font-[family-name:var(--font-display)] text-2xl font-black">{text.title}</SheetTitle>
        <SheetDescription className="m-0 text-base font-semibold">{text.description}</SheetDescription>
      </SheetHeader>

      <div className="grid gap-4 px-4 pb-5">
        <Block step={1} title={text.blocks.who}>
          <StudentPicker value={draft.studentId} onChange={pickStudent} />
          {student && (
            <dl className="m-0 grid grid-cols-3 gap-2 text-sm">
              {[
                { label: text.studentFacts.goal, value: student.goal || "—" },
                { label: text.studentFacts.usual, value: student.schedule.timesPerWeek > 0 ? [student.schedule.days.join(", "), usualTime].filter(Boolean).join(" · ") : "—" },
                { label: text.studentFacts.balance, value: formatRubles(student.balance) },
              ].map((fact) => (
                <div key={fact.label} className="grid min-w-0 gap-0.5 rounded-xl bg-card/80 px-3 py-2">
                  <dt className="text-xs font-bold text-muted-foreground">{fact.label}</dt>
                  <dd className={cx("m-0 truncate font-extrabold", fact.label === text.studentFacts.balance && student.balance < 0 && "text-destructive")}>{fact.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </Block>

        <Block step={2} title={text.blocks.when}>
          <div className="grid grid-cols-7 gap-1.5" role="group" aria-label={text.quickDates}>
            {quickDates.map((date) => {
              const busy = schedule.lessons.filter((lesson) => lesson.date === date && lesson.status !== "cancelled").length;
              const on = draft.date === date;
              return (
                <button
                  key={date}
                  type="button"
                  aria-pressed={on}
                  onClick={() => update({ date })}
                  className={cx(
                    "grid justify-items-center gap-0.5 rounded-xl border px-1 py-2 [font-family:inherit] transition-colors",
                    on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-secondary",
                  )}
                >
                  <span className={cx("text-[11px] font-bold uppercase", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{cabinet.weekdays[weekdayIndex(date)]}</span>
                  <b className="font-[family-name:var(--font-display)] text-lg leading-none font-black tabular-nums">{Number(date.slice(8, 10))}</b>
                  <span className={cx("text-[10px] font-bold tabular-nums", on ? "text-primary-foreground/80" : "text-muted-foreground")}>{text.dayLoad(busy)}</span>
                </button>
              );
            })}
          </div>
          <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-3">
            <Field label={text.date}>
              <Input type="date" className={big} value={draft.date} min={schedule.today} aria-label={text.date} onChange={(event) => event.target.value && update({ date: event.target.value })} />
            </Field>
            <Field label={text.time}>
              <Input type="time" className={big} step={TIME_STEP_MIN * 60} value={draft.start} aria-label={text.time} onChange={(event) => event.target.value && update({ start: event.target.value })} />
            </Field>
          </div>
          {(windows.length > 0 || usualTime) && (
            <div className="grid gap-2">
              <span className="text-sm font-bold text-foreground/75">{text.freeTitle}</span>
              <div className="flex flex-wrap gap-1.5">
                {usualTime && (
                  <button type="button" onClick={() => update({ start: usualTime })} className="h-9 rounded-full border border-primary bg-accent px-3 text-sm font-bold text-accent-foreground [font-family:inherit]">
                    {text.usualTime(usualTime)}
                  </button>
                )}
                {windows.map(({ window }) => (
                  <button
                    key={window.start}
                    type="button"
                    onClick={() => update({ start: window.start })}
                    className={cx(
                      "h-9 rounded-full border px-3 text-sm font-bold tabular-nums [font-family:inherit] transition-colors",
                      draft.start === window.start ? "border-success bg-[var(--cab-ok-soft)] text-success" : "border-border bg-card hover:bg-secondary",
                    )}
                  >
                    {window.start}–{window.end}
                  </button>
                ))}
              </div>
            </div>
          )}
          <Field label={text.duration}>
            <div className="flex flex-wrap items-center gap-2">
              <ToggleGroup
                type="single"
                spacing={1}
                value={customDuration ? "custom" : String(draft.durationMin)}
                aria-label={text.duration}
                className="gap-1 rounded-xl border bg-card p-1"
                onValueChange={(value) => {
                  if (!value) return;
                  setDurationTouched(true);
                  if (value === "custom") return setCustomDuration(true);
                  setCustomDuration(false);
                  update({ durationMin: Number(value) });
                }}
              >
                {text.durations.map((minutes) => (
                  <ToggleGroupItem key={minutes} value={String(minutes)} className={cx(toggleItem, "px-4")}>
                    {minutes}
                  </ToggleGroupItem>
                ))}
                <ToggleGroupItem value="custom" className={cx(toggleItem, "px-4")}>
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
                    className={cx(big, "w-24")}
                    onChange={(event) => update({ durationMin: Number(event.target.value) || 0 })}
                  />
                  <span className="text-base font-semibold text-muted-foreground">{text.minutesShort}</span>
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
              className="w-full gap-1 rounded-xl border bg-card p-1"
              onValueChange={(value) => value && setRepeat(value as "none" | "weekly")}
            >
              {text.repeatModes.map((mode) => (
                <ToggleGroupItem key={mode.id} value={mode.id} className={cx(toggleItem, "flex-1")}>
                  {mode.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            {draft.repeat.kind === "weekly" && (
              <div className="mt-1 grid gap-3">
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
                      className="h-10 flex-1 rounded-lg border bg-card px-0 text-base font-bold data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                    >
                      {day}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
                <label className="flex items-center gap-3">
                  <span className="text-sm font-bold text-foreground/75">{text.until}</span>
                  <Input
                    type="date"
                    className={big}
                    value={draft.repeat.until}
                    min={draft.date}
                    aria-label={text.until}
                    onChange={(event) => event.target.value && draft.repeat.kind === "weekly" && update({ repeat: { ...draft.repeat, until: event.target.value } })}
                  />
                </label>
              </div>
            )}
          </Field>
        </Block>

        <Block step={3} title={text.blocks.how}>
          <Field label={text.type}>
            <ToggleGroup
              type="single"
              spacing={1}
              value={draft.type}
              aria-label={text.type}
              className="w-full gap-1 rounded-xl border bg-card p-1"
              onValueChange={(value) => value && update({ type: value as LessonType })}
            >
              {(Object.keys(types) as LessonType[]).map((type) => (
                <ToggleGroupItem key={type} value={type} className={cx(toggleItem, "flex-1 px-2")}>
                  {types[type]}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </Field>
          <Field label={text.link} hint={text.optional}>
            <Input type="url" inputMode="url" className={big} value={draft.link} placeholder={text.linkPlaceholder} aria-label={text.link} onChange={(event) => update({ link: event.target.value })} />
          </Field>
        </Block>

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

      <SheetFooter className="sticky bottom-0 mt-auto gap-3 border-t bg-background/90 backdrop-blur">
        <div className="glass grid gap-0.5 rounded-2xl px-4 py-3 [--glass-bg:color-mix(in_srgb,var(--cab-blue-soft)_70%,transparent)]">
          <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{text.summaryTitle}</span>
          <b className="font-[family-name:var(--font-display)] text-lg font-black text-primary">{summary}</b>
          {student && <span className="text-sm font-semibold text-muted-foreground">{student.name}</span>}
        </div>
        {shownErrors.length > 0 && (
          <ul className="m-0 grid list-none gap-0.5 p-0 text-sm font-semibold text-[var(--color-error)]" role="alert">
            {shownErrors.map((error) => (
              <li key={error}>{errorText(error)}</li>
            ))}
          </ul>
        )}
        <Button variant="primary" className="h-12 text-base" onClick={submit}>
          {text.submit(Math.max(count, 1))}
        </Button>
      </SheetFooter>
    </>
  );
}

export function NewLessonSheet({ seed, onClose, onCreated }: Props) {
  return (
    <Sheet open={seed !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full gap-0 overflow-y-auto sm:max-w-lg">
        {seed && <NewLessonForm seed={seed} onClose={onClose} onCreated={onCreated} />}
      </SheetContent>
    </Sheet>
  );
}
