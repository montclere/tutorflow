import { cabinet } from "../../content/cabinet.ru";
import type { Student } from "../../mocks/types";
import { formatPackage, formatRubles, formatSigned, formatTimesPerWeek } from "../../model/format";
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
  return balance === 0 ? formatRubles(0) : formatSigned(balance);
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
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table aria-label={text.listLabel}>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              {text.columns.map((column) => (
                <TableHead key={column} className="h-11 px-4 text-xs font-extrabold tracking-wide text-muted-foreground uppercase first:pl-5">
                  {column}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {students.map((student) => {
              const schedule = scheduleText(student);
              const payment = paymentText(student);
              return (
                <TableRow
                  key={student.id}
                  className="cursor-pointer transition-colors duration-150 focus-within:bg-secondary data-[state=selected]:bg-accent motion-reduce:transition-none"
                  data-state={student.id === selectedId ? "selected" : undefined}
                  onClick={() => onOpen(student.id)}
                >
                  <TableCell className="max-w-72 px-4 py-3 pl-5">
                    <div className="flex items-center gap-3">
                      <Avatar initials={student.initials} color={student.color} />
                      <div className="min-w-0">
                        <button
                          type="button"
                          data-student-button={student.id}
                          aria-label={text.openCard(student.name)}
                          className="block max-w-full truncate rounded-sm border-0 bg-transparent p-0 text-left text-sm font-extrabold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40"
                        >
                          {student.name}
                        </button>
                        <TruncatedText text={student.goal} className="text-xs font-semibold text-muted-foreground" />
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="px-4 py-3">
                    <b className="block text-sm">{schedule.title}</b>
                    <span className="text-xs font-semibold text-muted-foreground">{schedule.note}</span>
                  </TableCell>
                  <TableCell className="max-w-56 px-4 py-3">
                    <b className="block text-sm">{payment.title}</b>
                    <TruncatedText text={payment.note} className="text-xs font-semibold text-muted-foreground tabular-nums" />
                  </TableCell>
                  <TableCell className={cx("px-4 py-3 font-[family-name:var(--font-display)] text-sm font-extrabold whitespace-nowrap tabular-nums", balanceClass(student.balance))}>
                    {formatBalance(student.balance)}
                  </TableCell>
                  <TableCell className="px-4 py-3 text-sm font-bold whitespace-nowrap tabular-nums">{nextLessonText(student, today)}</TableCell>
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
              "flex w-full items-center gap-3 rounded-xl border border-border bg-card p-3 text-left transition-colors duration-150 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/40 active:bg-secondary motion-reduce:transition-none",
              student.id === selectedId && "border-primary bg-accent",
            )}
          >
            <Avatar initials={student.initials} color={student.color} />
            <span className="min-w-0 flex-1">
              <b className="block truncate text-sm">{student.name}</b>
              <span className="block truncate text-xs font-semibold text-muted-foreground">{student.goal}</span>
              <span className="block text-xs font-bold tabular-nums">{nextLessonText(student, today)}</span>
            </span>
            <span className={cx("font-[family-name:var(--font-display)] text-sm font-extrabold whitespace-nowrap tabular-nums", balanceClass(student.balance))}>
              {formatBalance(student.balance)}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
