import { ChevronRight } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import type { Student } from "../../mocks/types";
import { formatPackage, formatRubles, formatTimesPerWeek } from "../../model/format";
import { formatNextLesson } from "../../model/students";
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

function balanceBadge(balance: number): string {
  if (balance < 0) return "bg-[var(--cab-bad-soft)] text-destructive";
  return balance > 0 ? "bg-[var(--cab-ok-soft)] text-success" : "text-muted-foreground";
}

function scheduleText(student: Student) {
  const { timesPerWeek, days } = student.schedule;
  return timesPerWeek === 0 ? { title: text.noSchedule, note: "" } : { title: formatTimesPerWeek(timesPerWeek), note: days.join(", ") };
}

function paymentText(student: Student) {
  const { model, pricePerLesson, package: pack } = student.payment;
  if (model === "package" && pack) {
    return { title: text.payment.package, note: formatPackage(pack.lessons, pack.price, pack.left) };
  }
  return { title: text.payment.perLesson, note: text.payment.pricePerLesson(formatRubles(pricePerLesson)) };
}

export function nextLessonText(student: Student, today: string): string {
  return student.nextLesson
    ? formatNextLesson(student.nextLesson, today, { ...text.nextLesson, weekdays: cabinet.weekdays })
    : text.noNextLesson;
}

type Props = { students: Student[]; today: string; selectedId: string | null; onOpen: (id: string) => void };

export function StudentsTable({ students, today, selectedId, onOpen }: Props) {
  return (
    <div className="max-[520px]:hidden">
      <div className="overflow-hidden rounded-2xl border bg-card">
        <Table aria-label={text.listLabel} className="text-base">
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {text.columns.map((column) => (
                <TableHead key={column} className="h-12 bg-secondary px-4 text-sm font-bold text-muted-foreground first:pl-6">
                  {column}
                </TableHead>
              ))}
              <TableHead className="w-10 bg-secondary px-4" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => {
              const schedule = scheduleText(student);
              const payment = paymentText(student);
              const next = nextLessonText(student, today);
              const soon = next.startsWith(text.nextLesson.today) || next.startsWith(text.nextLesson.tomorrow);
              return (
                <TableRow
                  key={student.id}
                  className="group cursor-pointer transition-colors duration-150 hover:bg-secondary/50 focus-within:bg-secondary data-[state=selected]:bg-accent motion-reduce:transition-none"
                  data-state={student.id === selectedId ? "selected" : undefined}
                  onClick={() => onOpen(student.id)}
                >
                  <TableCell className="max-w-80 px-4 py-4 pl-6">
                    <div className="flex items-center gap-3.5">
                      <Avatar initials={student.initials} color={student.color} />
                      <div className="min-w-0">
                        <button
                          type="button"
                          data-student-button={student.id}
                          aria-label={text.openCard(student.name)}
                          className="block max-w-full truncate rounded-sm border-0 bg-transparent p-0 text-left text-base font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          {student.name}
                        </button>
                        <TruncatedText text={student.goal} className="text-sm font-semibold text-muted-foreground" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-4">
                    <b className="block text-base">{schedule.title}</b>
                    <span className="text-sm font-semibold text-muted-foreground">{schedule.note}</span>
                  </TableCell>
                  <TableCell className="max-w-56 px-4 py-4">
                    <b className="block text-base">{payment.title}</b>
                    <TruncatedText text={payment.note} className="text-sm font-semibold text-muted-foreground tabular-nums" />
                  </TableCell>
                  <TableCell className="px-4 py-4 whitespace-nowrap">
                    <span className={cx("inline-flex rounded-full px-3 py-1 text-sm font-extrabold tabular-nums", balanceBadge(student.balance))}>
                      {formatBalance(student.balance)}
                    </span>
                  </TableCell>
                  <TableCell className={cx("px-4 py-4 text-base font-bold whitespace-nowrap tabular-nums", soon ? "text-primary" : next === text.noNextLesson && "text-muted-foreground")}>
                    {next}
                  </TableCell>
                  <TableCell className="px-4 py-4 pr-5">
                    <ChevronRight size={18} className="text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </TableCell>
                </TableRow>
              );
            })}
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
            <span className="min-w-0 flex-1">
              <b className="block truncate text-base font-extrabold">{student.name}</b>
              <span className="block truncate text-sm font-semibold text-muted-foreground">{student.goal}</span>
              <span className="block text-sm font-bold tabular-nums">{nextLessonText(student, today)}</span>
            </span>
            <span className={cx("max-w-28 text-right text-sm font-extrabold tabular-nums", balanceClass(student.balance))}>{formatBalance(student.balance)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
