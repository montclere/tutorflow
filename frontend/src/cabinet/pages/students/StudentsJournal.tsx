import { ArrowLeftRight, Ban, Check } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { RecentLesson, Student } from "../../mocks/types";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { balanceBadge, formatBalance } from "./StudentsTable";

const text = cabinet.teacher.students.journal;
const MAX_DAYS = 10;
const GOOD = 0.8;
const weekday = new Intl.DateTimeFormat("ru-RU", { weekday: "short", timeZone: "UTC" });

const day = (iso: string) => Number(iso.slice(8, 10));
const weekdayOf = (iso: string) => weekday.format(new Date(`${iso}T00:00:00Z`)).replace(".", "");

/** Даты журнала — последние дни, когда был хотя бы один урок у учеников из списка, по возрастанию. */
export function journalDates(students: Student[], limit = MAX_DAYS): string[] {
  const dates = new Set(students.flatMap((student) => student.recentLessons.map((lesson) => lesson.date)));
  return [...dates].sort().slice(-limit);
}

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

function Mark({ lesson }: { lesson: RecentLesson | undefined }) {
  if (!lesson) return <span className="text-muted-foreground/40" aria-hidden="true">·</span>;
  if (lesson.status === "cancelled")
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground" title={text.cancelled}>
        <Ban size={14} aria-label={text.cancelled} />
      </span>
    );
  if (lesson.status === "moved")
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]" title={text.moved}>
        <ArrowLeftRight size={14} aria-label={text.moved} />
      </span>
    );
  const homework = lesson.homework;
  if (!homework)
    return (
      <span className="inline-flex size-7 items-center justify-center rounded-lg bg-[var(--cab-ok-soft)] text-success" title={text.done(lesson.topic)}>
        <Check size={15} aria-label={text.done(lesson.topic)} />
      </span>
    );
  const missing = homework.done === null;
  const share = missing ? 0 : (homework.done ?? 0) / homework.total;
  const tone = missing ? "bg-[var(--cab-bad-soft)] text-destructive" : share >= GOOD ? "bg-[var(--cab-ok-soft)] text-success" : "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]";
  const label = missing ? text.missing : `${homework.done}/${homework.total}`;
  return (
    <span className={cx("inline-flex h-7 min-w-11 items-center justify-center rounded-lg px-1.5 text-xs font-extrabold tabular-nums", tone)} title={text.homework(lesson.topic, homework.title, label)}>
      {label}
    </span>
  );
}

function Percent({ value }: { value: number | null }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  return <b className={cx("tabular-nums", value >= 80 ? "text-success" : value >= 60 ? "text-[var(--cab-warn)]" : "text-destructive")}>{value}%</b>;
}

type Props = { students: Student[]; selectedId: string | null; onOpen: (id: string) => void };

/**
 * Журнал учеников (STUDENTS-17): строки — ученики, колонки — даты уроков. В клетке — отметка урока
 * и результат ДЗ; справа — посещаемость, средний результат ДЗ и баланс. Имя закреплено при прокрутке.
 */
export function StudentsJournal({ students, selectedId, onOpen }: Props) {
  const dates = journalDates(students);
  return (
    <div className="max-[520px]:hidden">
      <div className="glass overflow-x-auto rounded-2xl">
        <table className="w-full border-separate border-spacing-0 text-sm" aria-label={text.label}>
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 min-w-56 border-b border-border/70 bg-card/90 px-4 py-3 text-left text-xs font-bold tracking-wide text-muted-foreground uppercase backdrop-blur">
                {text.student}
              </th>
              {dates.map((date) => (
                <th key={date} scope="col" className="min-w-14 border-b border-l border-border/70 px-1 py-2 text-center font-semibold text-muted-foreground">
                  <span className="block font-[family-name:var(--font-display)] text-sm font-extrabold text-foreground tabular-nums">{day(date)}</span>
                  <span className="block text-[11px]">{weekdayOf(date)}</span>
                </th>
              ))}
              {[text.attendance, text.average, text.balance].map((label) => (
                <th key={label} scope="col" className="border-b border-l border-border/70 bg-secondary/60 px-3 py-3 text-left text-xs font-bold tracking-wide whitespace-nowrap text-muted-foreground uppercase">
                  {label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((student, index) => {
              const byDate = new Map(student.recentLessons.map((lesson) => [lesson.date, lesson]));
              const selected = student.id === selectedId;
              return (
                <tr key={student.id} className={cx("group cursor-pointer", selected && "[&>td]:bg-accent/70")} onClick={() => onOpen(student.id)}>
                  <th scope="row" className={cx("sticky left-0 z-10 border-b border-border/70 bg-card/90 px-4 py-2.5 text-left font-normal backdrop-blur group-hover:bg-secondary", selected && "bg-accent")}>
                    <span className="flex items-center gap-3">
                      <span className="w-5 text-xs font-bold text-muted-foreground tabular-nums">{index + 1}</span>
                      <Avatar initials={student.initials} color={student.color} />
                      <span className="grid min-w-0">
                        <button
                          type="button"
                          data-student-button={student.id}
                          aria-label={cabinet.teacher.students.openCard(student.name)}
                          className="block max-w-full truncate rounded-sm border-0 bg-transparent p-0 text-left text-sm font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          {student.name}
                        </button>
                        <span className="truncate text-xs font-semibold text-muted-foreground">{student.goal}</span>
                      </span>
                    </span>
                  </th>
                  {dates.map((date) => (
                    <td key={date} className="border-b border-l border-border/70 px-1 py-2 text-center group-hover:bg-secondary/50">
                      <Mark lesson={byDate.get(date)} />
                    </td>
                  ))}
                  <td className="border-b border-l border-border/70 bg-secondary/30 px-3 py-2 group-hover:bg-secondary/60">
                    <Percent value={attendance(student)} />
                  </td>
                  <td className="border-b border-l border-border/70 bg-secondary/30 px-3 py-2 group-hover:bg-secondary/60">
                    <Percent value={homeworkAverage(student)} />
                  </td>
                  <td className="border-b border-l border-border/70 bg-secondary/30 px-3 py-2 group-hover:bg-secondary/60">
                    <span className={cx("inline-flex rounded-full px-2.5 py-0.5 text-xs font-extrabold whitespace-nowrap tabular-nums", balanceBadge(student.balance))}>{formatBalance(student.balance)}</span>
                  </td>
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
