import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, Ban, Check } from "lucide-react";
import { useState } from "react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";
import { attendance, homeworkAverage } from "../../model/students";
import { addDays } from "../../model/dates";
import { cabinet } from "../../content/cabinet.ru";
import type { RecentLesson, Student } from "../../mocks/types";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { formatRubles } from "../../model/format";
import { balanceBadge, formatBalance } from "./StudentsTable";

import styles from "./students.module.css";

const text = cabinet.teacher.students.journal;
const GOOD = 0.8;
const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });

const day = (iso: string) => Number(iso.slice(8, 10));
const weekdayOf = (iso: string) => weekday.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

/** Посещаемость — доля проведённых среди проведённых и отменённых; перенос не считается пропуском. */
export { attendance, homeworkAverage } from "../../model/students";

function Mark({ lesson, compact }: { lesson: RecentLesson | undefined; compact?: boolean }) {
  if (!lesson) return <span className="text-muted-foreground/60" aria-hidden="true">—</span>;
  if (lesson.status === "cancelled")
    return (
      <span className={cx("inline-flex items-center justify-center rounded-full", compact ? "size-5" : "size-7", "bg-secondary text-muted-foreground")} title={text.cancelled}>
        <Ban size={14} aria-label={text.cancelled} />
      </span>
    );
  if (lesson.status === "moved")
    return (
      <span className={cx("inline-flex items-center justify-center rounded-full", compact ? "size-5" : "size-7", "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]")} title={text.moved}>
        <ArrowLeftRight size={14} aria-label={text.moved} />
      </span>
    );
  const homework = lesson.homework;
  if (!homework)
    return (
      <span className={cx("inline-flex items-center justify-center rounded-full", compact ? "size-5" : "size-7", "bg-[var(--cab-ok-soft)] text-success")} title={text.done(lesson.topic)}>
        <Check size={15} aria-label={text.done(lesson.topic)} />
      </span>
    );
  const missing = homework.done === null;
  const share = missing ? 0 : (homework.done ?? 0) / homework.total;
  const tone = missing ? "bg-[var(--cab-bad-soft)] text-destructive" : share >= GOOD ? "bg-[var(--cab-ok-soft)] text-success" : "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]";
  const label = missing ? text.missing : `${homework.done}/${homework.total}`;
  return (
    <span className={cx(styles.resultMark, "inline-flex items-center justify-center rounded-full px-2 font-extrabold tabular-nums", compact ? "h-5 min-w-9 text-[10px]" : "h-7 min-w-11 text-xs", tone)} title={text.homework(lesson.topic, homework.title, label)}>
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

const headCell = styles.head;
const sumCell = styles.summaryCell;
const stickyName = styles.nameCol;
const stickyAttendance = styles.attendanceCol;
const stickyAverage = styles.averageCol;
const stickyBalance = styles.balanceCol;

/** Заголовок итоговой колонки: стрелка показывает текущую сортировку, выбор — кнопкой «Сортировка». */
function Head({ id, label, className, sort }: { id: JournalSort["key"]; label: string; className?: string; sort: JournalSort }) {
  const active = sort.key === id;
  const Icon = sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={cx(headCell, className, active && "text-foreground")}>
      <span className="inline-flex items-center gap-1">
        {label}
        {active && <Icon size={13} aria-hidden="true" />}
      </span>
    </th>
  );
}

const sortKeys: JournalSort["key"][] = ["name", "attendance", "average", "balance"];

/** Сортировка отдельной кнопкой (STUDENTS-17): признак и порядок — в меню. */
function SortMenu({ sort, onSort }: { sort: JournalSort; onSort: (sort: JournalSort) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className={styles.sort}>
          <ArrowUpDown size={15} aria-hidden="true" />
          {text.sort.button}: <span className="text-primary">{text.sort.keys[sort.key]}</span>
          <span className="text-muted-foreground">{text.sort.dirs[sort.key][sort.dir]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className="w-64 rounded-xl p-1.5">
        <DropdownMenuLabel className="px-2 text-xs font-bold text-muted-foreground">{text.sort.by}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort.key} onValueChange={(key) => onSort({ key: key as JournalSort["key"], dir: key === "name" ? "asc" : "desc" })}>
          {sortKeys.map((key) => (
            <DropdownMenuRadioItem key={key} value={key} className="rounded-lg py-2 text-sm font-bold">
              {text.sort.keys[key]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuLabel className="px-2 text-xs font-bold text-muted-foreground">{text.sort.order}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={sort.dir} onValueChange={(dir) => onSort({ ...sort, dir: dir as JournalSort["dir"] })}>
          {(["asc", "desc"] as const).map((dir) => (
            <DropdownMenuRadioItem key={dir} value={dir} className="rounded-lg py-2 text-sm font-bold">
              {text.sort.dirs[sort.key][dir]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * Журнал учеников (STUDENTS-17): строки — ученики, колонки — даты уроков за период, от свежих к старым.
 * Слева закреплены имя и итоги (посещаемость, ДЗ, баланс), даты прокручиваются вбок; шапка закреплена,
 * длинный список прокручивается внутри. Сортировка — отдельной кнопкой с выбором признака и порядка.
 */
export function StudentsJournal({ students, today, selectedId, onOpen }: Props) {
  const [period, setPeriod] = useState<JournalPeriod>(14);
  const [sort, setSort] = useState<JournalSort>({ key: "name", dir: "asc" });
  const dates = periodDates(students, today, period);
  const rows = sortStudents(students, sort);


  return (
    <div className="max-[520px]:hidden">
      <div className={styles.journalControls}>
        <ToggleGroup type="single" spacing={1} value={String(period)} aria-label={text.periodLabel} className={styles.period} onValueChange={(value) => value && setPeriod(Number(value) as JournalPeriod)}>
          {([14, 31] as const).map((days) => (
            <ToggleGroupItem key={days} value={String(days)} className="h-7 px-3 text-sm font-bold data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              {text.periods[days]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <div className={styles.journalMeta}>
          <span className="text-sm font-semibold text-muted-foreground">{text.counts(rows.length, dates.length)}</span>
          <SortMenu sort={sort} onSort={setSort} />
        </div>
      </div>
      {/* Область прокрутки доступна с клавиатуры: стрелки прокручивают даты без выбора ученика. */}
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex */}
      <div className={styles.journal} role="region" aria-label={text.label} tabIndex={0}>
        <table className={styles.table} aria-label={text.label}>
          <thead>
            <tr>
              <Head sort={sort} id="name" label={text.student} className={cx(stickyName, "z-30")} />
              <Head sort={sort} id="attendance" label={text.attendance} className={stickyAttendance} />
              <Head sort={sort} id="average" label={text.average} className={stickyAverage} />
              <Head sort={sort} id="balance" label={text.balance} className={stickyBalance} />
              {dates.map((date) => (
                <th key={date} scope="col" className={cx(headCell, styles.dateHead, date === today && styles.today)}>
                  <b>{day(date)}</b>
                  <small>{weekdayOf(date)}</small>
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
                <tr key={student.id} className={cx("group", styles.row, selected && styles.selected)} onClick={() => onOpen(student.id)}>
                  <th scope="row" className={cx(stickyName, styles.personCell)}>
                    <span className={styles.person}>
                      <span className={styles.rowIndex}>{index + 1}</span>
                      <Avatar initials={student.initials} color={student.color} />
                      <span className={styles.personText}>
                        <button
                          type="button"
                          data-student-button={student.id}
                          aria-label={cabinet.teacher.students.openCard(student.name)}
                          className="focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          {student.name}
                        </button>
                        <small>{student.goal}</small>
                      </span>
                    </span>
                  </th>
                  <td className={cx(sumCell, stickyAttendance)}>
                    <Percent value={attendance(student)} />
                  </td>
                  <td className={cx(sumCell, stickyAverage)}>
                    <Percent value={homeworkAverage(student)} />
                  </td>
                  <td className={cx(sumCell, stickyBalance)}>
                    <span title={formatBalance(student.balance)} className={cx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap", balanceBadge(student.balance))}>
                      {shortBalance(student.balance)}
                    </span>
                  </td>
                  {dates.map((date) => (
                    <td key={date} className={cx(styles.dateCell, date === today && styles.today)}>
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
      <ul className={styles.legend} aria-label={text.legendLabel}>
        <li className="flex items-center gap-1.5"><span className="inline-flex h-5 min-w-8 items-center justify-center rounded-md bg-[var(--cab-ok-soft)] px-1 text-[10px] font-extrabold text-success">9/10</span>{text.legend.homework}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex h-5 min-w-8 items-center justify-center rounded-md bg-[var(--cab-bad-soft)] px-1 text-[10px] font-extrabold text-destructive">{text.missing}</span>{text.legend.missing}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cab-ok-soft)] text-success"><Check size={12} aria-hidden="true" /></span>{text.legend.done}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]"><ArrowLeftRight size={12} aria-hidden="true" /></span>{text.moved}</li>
        <li className="flex items-center gap-1.5"><span className="inline-flex size-5 items-center justify-center rounded-md bg-secondary text-muted-foreground"><Ban size={12} aria-hidden="true" /></span>{text.cancelled}</li>
      </ul>
    </div>
  );
}
