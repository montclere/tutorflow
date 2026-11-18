import { ChevronRight } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { Student } from "../../mocks/types";
import { formatRubles, formatTimesPerWeek } from "../../model/format";
import { lessonsAhead } from "../../model/finance";
import { debtLessons, formatNextLesson, lastHomework, paymentStatus } from "../../model/students";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { TruncatedText } from "../../ui/TruncatedText";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/kit/table";

const text = cabinet.teacher.students;

export function balanceClass(balance: number): string {
  if (balance < 0) return "text-destructive";
  return balance > 0 ? "text-success" : "text-muted-foreground";
}

export function formatBalance(balance: number): string {
  if (balance < 0) return `${text.balance.debt} ${formatRubles(balance)}`;
  if (balance > 0) return `${text.balance.prepaid} ${formatRubles(balance)}`;
  return text.balance.zero;
}

/** Ноль — тоже чип, нейтральный: колонка баланса выглядит ровно. */
function balanceBadge(balance: number): string {
  if (balance < 0) return "bg-[var(--cab-bad-soft)] text-destructive";
  return balance > 0 ? "bg-[var(--cab-ok-soft)] text-success" : "bg-secondary text-muted-foreground";
}

export function nextLessonText(student: Student, today: string): string {
  return student.nextLesson
    ? formatNextLesson(student.nextLesson, today, { ...text.nextLesson, weekdays: cabinet.weekdays })
    : text.noNextLesson;
}

function isSoon(next: string): boolean {
  return next.startsWith(text.nextLesson.today) || next.startsWith(text.nextLesson.tomorrow);
}

/** Подпись под суммой объясняет её в уроках: за сколько уроков долг или на сколько хватит предоплаты. */
export function balanceNote(student: Student): { text: string; warn: boolean } | null {
  const left = student.payment.package?.left;
  if (paymentStatus(student) === "low" && left !== undefined) return { text: text.packageLow(left), warn: true };
  if (student.balance < 0) return { text: text.balanceNote.debt(debtLessons(student)), warn: false };
  const ahead = lessonsAhead(student);
  return ahead > 0 ? { text: text.balanceNote.prepaid(ahead), warn: false } : null;
}

function Balance({ student, inline }: { student: Student; inline?: boolean }) {
  const note = balanceNote(student);
  return (
    <span className={cx("flex items-start gap-1", inline ? "flex-row flex-wrap items-center gap-2" : "flex-col")}>
      <span className={cx("inline-flex rounded-full px-3 py-1 text-sm font-extrabold whitespace-nowrap tabular-nums", balanceBadge(student.balance))}>
        {formatBalance(student.balance)}
      </span>
      {note && <span className={cx("text-xs font-bold", note.warn ? "text-[var(--cab-warn)]" : "text-muted-foreground")}>{note.text}</span>}
    </span>
  );
}

function Schedule({ student }: { student: Student }) {
  const { timesPerWeek, days, time } = student.schedule;
  if (timesPerWeek === 0) return <span className="text-sm font-semibold text-muted-foreground">{text.noSchedule}</span>;
  return (
    <span className="grid">
      <b className="text-sm font-bold whitespace-nowrap">{days.join(", ")}</b>
      {/* Разное время по дням ничего не говорит в таблице — тогда показываем частоту. */}
      <span className="text-sm font-semibold whitespace-nowrap text-muted-foreground tabular-nums">{time === text.mixedTime ? formatTimesPerWeek(timesPerWeek) : time}</span>
    </span>
  );
}

const GOOD_HOMEWORK_SHARE = 0.8;

function Homework({ student }: { student: Student }) {
  const homework = lastHomework(student);
  if (!homework) return <span className="text-sm font-semibold text-muted-foreground">{text.homework.none}</span>;
  const label = homework.state === "missing" ? text.homework.missing : text.homework.done(homework.done, homework.total);
  const tone =
    homework.state === "missing"
      ? "bg-[var(--cab-bad-soft)] text-destructive"
      : homework.done / homework.total >= GOOD_HOMEWORK_SHARE
        ? "bg-[var(--cab-ok-soft)] text-success"
        : "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]";
  return (
    <span className={cx("inline-flex rounded-full px-2.5 py-1 text-sm font-extrabold whitespace-nowrap tabular-nums", tone)} aria-label={text.homework.label(label)}>
      {label}
    </span>
  );
}

function Waiting({ student }: { student: Student }) {
  if (student.telegramConnected) return null;
  return <span className="inline-flex rounded-full bg-[var(--cab-warn-soft)] px-2 py-0.5 text-xs font-bold whitespace-nowrap text-[var(--cab-warn)]">{text.waiting}</span>;
}

function NextLesson({ student, today }: { student: Student; today: string }) {
  const next = nextLessonText(student, today);
  if (!student.nextLesson) return <span className="text-base font-semibold text-muted-foreground">{next}</span>;
  return (
    <span className={cx("inline-flex items-center gap-2 text-base whitespace-nowrap tabular-nums", isSoon(next) ? "font-extrabold" : "font-semibold")}>
      {isSoon(next) && <span className="size-2 rounded-full bg-primary" aria-hidden="true" />}
      {next}
    </span>
  );
}

type Props = { students: Student[]; today: string; selectedId: string | null; onOpen: (id: string) => void };

/** В таблице главное: кто, когда занимается, следующий урок, как с ДЗ и с оплатой (STUDENTS-1). */
export function StudentsTable({ students, today, selectedId, onOpen }: Props) {
  return (
    <div className="max-[520px]:hidden">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table aria-label={text.listLabel} className="text-base">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {text.columns.map((column) => (
                <TableHead key={column} className="h-11 px-4 text-xs font-bold tracking-wide text-muted-foreground uppercase first:pl-6">
                  {column}
                </TableHead>
              ))}
              <TableHead className="w-10 px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => (
              <TableRow
                key={student.id}
                className="group cursor-pointer transition-colors duration-150 hover:bg-secondary/50 focus-within:bg-secondary data-[state=selected]:bg-accent motion-reduce:transition-none"
                data-state={student.id === selectedId ? "selected" : undefined}
                onClick={() => onOpen(student.id)}
              >
                <TableCell className="w-[30%] max-w-0 px-4 py-4 pl-6">
                  <div className="flex items-center gap-3.5">
                    <Avatar initials={student.initials} color={student.color} />
                    <div className="min-w-0">
                      <span className="flex min-w-0 items-center gap-2">
                        <button
                          type="button"
                          data-student-button={student.id}
                          aria-label={text.openCard(student.name)}
                          className="block max-w-full truncate rounded-sm border-0 bg-transparent p-0 text-left text-base font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          {student.name}
                        </button>
                        <Waiting student={student} />
                      </span>
                      {student.goal && <TruncatedText text={student.goal} className="text-sm font-semibold text-muted-foreground" />}
                    </div>
                  </div>
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Schedule student={student} />
                </TableCell>
                <TableCell className="px-4 py-4">
                  <NextLesson student={student} today={today} />
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Homework student={student} />
                </TableCell>
                <TableCell className="px-4 py-4">
                  <Balance student={student} />
                </TableCell>
                <TableCell className="px-4 py-4 pr-5">
                  <ChevronRight size={18} className="text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export function StudentCards({ students, today, selectedId, onOpen }: Props) {
  return (
    <ul className="m-0 hidden list-none flex-col gap-2 p-0 max-[520px]:flex" aria-label={text.listLabel}>
      {students.map((student) => (
        <li key={student.id}>
          <button
            type="button"
            data-student-button={student.id}
            aria-label={text.openCard(student.name)}
            onClick={() => onOpen(student.id)}
            className={cx(
              "flex w-full items-center gap-3 rounded-2xl border border-border bg-card p-4 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:bg-secondary motion-reduce:transition-none",
              student.id === selectedId && "border-primary bg-accent",
            )}
          >
            <Avatar initials={student.initials} color={student.color} />
            {/* На телефоне баланс под именем: широкий чип справа сжимал имя. */}
            <span className="grid min-w-0 flex-1 gap-1">
              <span className="flex min-w-0 items-center gap-2">
                <b className="truncate text-base font-extrabold">{student.name}</b>
                <Waiting student={student} />
              </span>
              {student.goal && <span className="block truncate text-sm font-semibold text-muted-foreground">{student.goal}</span>}
              <NextLesson student={student} today={today} />
              <Balance student={student} inline />
            </span>
            <ChevronRight size={18} className="flex-none text-muted-foreground" aria-hidden="true" />
          </button>
        </li>
      ))}
    </ul>
  );
}
