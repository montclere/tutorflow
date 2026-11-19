import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, Ban, Check } from "lucide-react";
import { useState } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { addDays } from "../../model/dates";
import { cabinet } from "../../content/cabinet.ru";
import type { RecentLesson, Student } from "../../mocks/types";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { formatRubles } from "../../model/format";
import { balanceBadge, formatBalance } from "./StudentsTable";

const text = cabinet.teacher.students.journal;
const GOOD = 0.8;
const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });

const day = (iso: string) => Number(iso.slice(8, 10));
const weekdayOf = (iso: string) => weekday.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

/** Посещаемость — доля проведённых среди проведённых и отменённых; перенос не считается пропуском. */
export function attendance(student: Student): number | null {
  const counted = student.recentLessons.filter((lesson) => lesson.status !== "moved");
  if (counted.length === 0) return null;
  return Math.round((counted.filter((lesson) => lesson.status === "done").length / counted.length) * 100);
}

/** Средний результат ДЗ по проверенным: несданное считается нулём. */
export function homeworkAverage(student: Student): number | null {
  const graded = student.recentLessons.flatMap((lesson) => (lesson.homework ? [lesson.homework] : []));
  if (graded.length === 0) return null;
  return Math.round((graded.reduce((sum, homework) => sum + (homework.done ?? 0) / homework.total, 0) / graded.length) * 100);
}

function Mark({ lesson, compact }: { lesson: RecentLesson | undefined; compact?: boolean }) {
  if (!lesson) return <span className="text-muted-foreground/40" aria-hidden="true">·</span>;
  if (lesson.status === "cancelled")
    return (
      <span className={cx("inline-flex items-center justify-center rounded-lg", compact ? "size-5" : "size-7", "bg-secondary text-muted-foreground")} title={text.cancelled}>
        <Ban size={14} aria-label={text.cancelled} />
      </span>
    );
  if (lesson.status === "moved")
    return (
      <span className={cx("inline-flex items-center justify-center rounded-lg", compact ? "size-5" : "size-7", "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]")} title={text.moved}>
        <ArrowLeftRight size={14} aria-label={text.moved} />
      </span>
    );
  const homework = lesson.homework;
  if (!homework)
    return (
      <span className={cx("inline-flex items-center justify-center rounded-lg", compact ? "size-5" : "size-7", "bg-[var(--cab-ok-soft)] text-success")} title={text.done(lesson.topic)}>
        <Check size={15} aria-label={text.done(lesson.topic)} />
      </span>
    );
  const missing = homework.done === null;
  const share = missing ? 0 : (homework.done ?? 0) / homework.total;
  const tone = missing ? "bg-[var(--cab-bad-soft)] text-destructive" : share >= GOOD ? "bg-[var(--cab-ok-soft)] text-success" : "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]";
  const label = missing ? text.missing : `${homework.done}/${homework.total}`;
  return (
    <span className={cx("inline-flex items-center justify-center rounded-lg px-1.5 font-extrabold tabular-nums", compact ? "h-5 min-w-9 text-[10px]" : "h-7 min-w-11 text-xs", tone)} title={text.homework(lesson.topic, homework.title, label)}>
      {label}
    </span>
  );
}

/** Баланс в журнале — коротко со знаком; полный текст — в подсказке. */
function shortBalance(balance: number): string {
  if (balance === 0) return "0 ₽";
  return `${balance > 0 ? "+" : "−"}${formatRubles(Math.abs(balance))}`;
}

function Percent({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <b className={cx("tabular-nums", value >= 80 ? "text-success" : value >= 60 ? "text-[var(--cab-warn)]" : "text-destructive")}>{value}%</b>;
}

export type JournalSort = { key: "name" | "attendance" | "average" | "balance"; dir: "asc" | "desc" };
export type JournalPeriod = 14 | 31;

/** Сортировка журнала: пустые значения (нет данных) — всегда в конце. */
export function sortStudents(students: Student[], sort: JournalSort): Student[] {
  const value = (student: Student): number | string | null =>
    sort.key === "name" ? student.name : sort.key === "attendance" ? attendance(student) : sort.key === "average" ? homeworkAverage(student) : student.balance;
  const sign = sort.dir === "asc" ? 1 : -1;
  return [...students].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null || right === null) return left === right ? 0 : left === null ? 1 : -1;
    return (typeof left === "string" ? left.localeCompare(String(right), "ru") : left - Number(right)) * sign;
  });
}

/** Даты периода с уроками — от свежих к старым: при большой нагрузке последние уроки видны без прокрутки. */
export function periodDates(students: Student[], today: string, days: JournalPeriod): string[] {
  const from = addDays(today, -(days - 1));
  const dates = new Set(students.flatMap((student) => student.recentLessons.map((lesson) => lesson.date)).filter((date) => date >= from && date <= today));
  return [...dates].sort().reverse();
}

type Props = { students: Student[]; today: string; selectedId: string | null; onOpen: (id: string) => void };

const headCell = "border-b border-border/70 bg-card/95 px-3 py-2.5 text-left text-xs font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase backdrop-blur";
const sumCell = "z-10 border-b border-border/70 bg-card/95 px-3 py-2 tabular-nums backdrop-blur group-hover:bg-secondary";
// Имя и итоги закреплены слева — при длинном периоде вбок прокручиваются только даты.
const stickyName = "sticky left-0 w-[240px] min-w-[240px] max-w-[240px]";
const stickyAttendance = "sticky left-[240px] w-[84px] min-w-[84px]";
const stickyAverage = "sticky left-[324px] w-[84px] min-w-[84px]";
const stickyBalance = "sticky left-[408px] w-[116px] min-w-[116px]";

function SortHead({ id, label, className, sort, onSort }: { id: JournalSort["key"]; label: string; className?: string; sort: JournalSort; onSort: (sort: JournalSort) => void }) {
  const active = sort.key === id;
  const Icon = !active ? ArrowUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cx(headCell, className)}>
      <button
        type="button"
        onClick={() => onSort({ key: id, dir: active && sort.dir === "asc" ? "desc" : id === "name" || active ? "asc" : "desc" })}
        className={cx("inline-flex items-center gap-1 border-0 bg-transparent p-0 text-xs font-bold tracking-wide uppercase [font-family:inherit]", active ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
      >
        {label}
        <Icon size={13} aria-hidden="true" />
      </button>
    </th>
  );
}

/**
 * Журнал учеников (STUDENTS-17): строки — ученики, колонки — даты уроков за период, от свежих к старым.
 * Слева закреплены имя и итоги (посещаемость, ДЗ, баланс), даты прокручиваются вбок; шапка закреплена,
 * длинный список прокручивается внутри. Сортировка — по клику на заголовок.
 */
export function StudentsJournal({ students, today, selectedId, onOpen }: Props) {
  const [period, setPeriod] = useState<JournalPeriod>(14);
  const [sort, setSort] = useState<JournalSort>({ key: "name", dir: "asc" });
  const dates = periodDates(students, today, period);
  const rows = sortStudents(students, sort);


  return (
    <div className="max-[520px]:hidden">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ToggleGroup type="single" spacing={1} value={String(period)} aria-label={text.periodLabel} className="gap-1 rounded-lg border bg-card p-1" onValueChange={(value) => value && setPeriod(Number(value) as JournalPeriod)}>
          {([14, 31] as const).map((days) => (
            <ToggleGroupItem key={days} value={String(days)} className="h-7 px-3 text-sm font-bold data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              {text.periods[days]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="text-sm font-semibold text-muted-foreground">{text.counts(rows.length, dates.length)}</span>
      </div>
      <div className="glass max-h-[calc(100vh-290px)] min-h-64 overflow-auto rounded-2xl">
        <table className="w-max min-w-full border-separate border-spacing-0 text-sm" aria-label={text.label}>
          <thead className="sticky top-0 z-20">
            <tr>
              <SortHead sort={sort} onSort={setSort} id="name" label={text.student} className={cx(stickyName, "z-30")} />
              <SortHead sort={sort} onSort={setSort} id="attendance" label={text.attendance} className={cx(stickyAttendance, "z-30 border-l")} />
              <SortHead sort={sort} onSort={setSort} id="average" label={text.average} className={cx(stickyAverage, "z-30 border-l")} />
              <SortHead sort={sort} onSort={setSort} id="balance" label={text.balance} className={cx(stickyBalance, "z-30 border-r-2 border-l border-r-border")} />
              {dates.map((date) => (
                <th key={date} scope="col" className={cx(headCell, "min-w-16 border-l px-1 text-center normal-case", date === today && "text-primary")}>
                  <span className={cx("block font-[family-name:var(--font-display)] text-sm font-extrabold tabular-nums", date === today ? "text-primary" : "text-foreground")}>{day(date)}</span>
                  <span className="block text-[11px] font-semibold">{weekdayOf(date)}</span>
                </th>
              ))}
              {dates.length === 0 && <th scope="col" className={cx(headCell, "w-full border-l normal-case")}>{text.noDates}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((student, index) => {
              const byDate = new Map<string, RecentLesson[]>();
              for (const lesson of student.recentLessons) byDate.set(lesson.date, [...(byDate.get(lesson.date) ?? []), lesson]);
              const selected = student.id === selectedId;
              return (
                <tr key={student.id} className={cx("group cursor-pointer", selected && "[&>td]:bg-accent/60")} onClick={() => onOpen(student.id)}>
                  <th scope="row" className={cx(stickyName, "z-10 border-b border-border/70 bg-card/95 px-3 py-2 text-left font-normal backdrop-blur group-hover:bg-secondary", selected && "bg-accent")}>
                    <span className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted-foreground tabular-nums">{index + 1}</span>
                      <Avatar initials={student.initials} color={student.color} />
                      <span className="grid min-w-0">
                        <button
                          type="button"
                          data-student-button={student.id}
                          aria-label={cabinet.teacher.students.openCard(student.name)}
                          className="block max-w-36 truncate rounded-sm border-0 bg-transparent p-0 text-left text-sm font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          {student.name}
                        </button>
                        <span className="max-w-36 truncate text-xs font-semibold text-muted-foreground">{student.goal}</span>
                      </span>
                    </span>
                  </th>
                  <td className={cx(sumCell, stickyAttendance, "border-l", selected && "bg-accent")}>
                    <Percent value={attendance(student)} />
                  </td>
                  <td className={cx(sumCell, stickyAverage, "border-l", selected && "bg-accent")}>
                    <Percent value={homeworkAverage(student)} />
                  </td>
                  <td className={cx(sumCell, stickyBalance, "border-r-2 border-l border-r-border", selected && "bg-accent")}>
                    <span title={formatBalance(student.balance)} className={cx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap", balanceBadge(student.balance))}>
                      {shortBalance(student.balance)}
                    </span>
                  </td>
                  {dates.map((date) => (
                    <td key={date} className={cx("border-b border-l border-border/70 px-1 py-2 text-center group-hover:bg-secondary/50", date === today && "bg-accent/30")}>
                      <span className="inline-grid gap-1">
                        {(byDate.get(date) ?? [undefined]).map((lesson, lessonIndex, all) => (
                          <Mark key={lessonIndex} lesson={lesson} compact={all.length > 1} />
                        ))}
                      </span>
                    </td>
                  ))}
                  {dates.length === 0 && <td className="border-b border-l border-border/70" />}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <ul className="m-0 mt-3 flex list-none flex-wrap gap-x-5 gap-y-2 p-0 text-xs font-semibold text-muted-foreground" aria-label={text.legendLabel}>
        <li className="flex items-center gap-1.5"><span className="inline-flex h-5 min-w-8 items-center justify-center rounded-md bg-[var(--cab-ok-soft)] px-1 text-[10px] font-extrabold text-success">9/10</span>{text.legend.homework}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex h-5 min-w-8 items-center justify-center rounded-md bg-[var(--cab-bad-soft)] px-1 text-[10px] font-extrabold text-destructive">{text.missing}</span>{text.legend.missing}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cab-ok-soft)] text-success"><Check size={12} aria-hidden="true" /></span>{text.legend.done}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]"><ArrowLeftRight size={12} aria-hidden="true" /></span>{text.moved}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex size-5 items-center justify-center rounded-md bg-secondary text-muted-foreground"><Ban size={12} aria-hidden="true" /></span>{text.cancelled}</li>
      </ul>
    </div>
  );
}
