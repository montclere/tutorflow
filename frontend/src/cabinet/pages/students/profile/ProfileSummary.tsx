import { CalendarPlus, Copy } from "lucide-react";
import type { ReactNode } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import type { Student } from "../../../mocks/types";
import { formatRubles, formatTimesPerWeek } from "../../../model/format";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { ProgressBar } from "../../../ui/ProgressBar";
import { inviteLink } from "../NewStudentDialog";
import { balanceClass, balanceNote, formatBalance, nextLessonText } from "../StudentsTable";

const students = cabinet.teacher.students;
const text = students.profile.summary;

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3 border-b border-border py-5 first:pt-0 last:border-b-0">
      <h3 className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Fact({ label, children, note, valueClass }: { label: string; children: ReactNode; note?: string | null; valueClass?: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-sm font-semibold text-muted-foreground">{label}</dt>
      <dd className={cx("m-0 text-base font-extrabold tabular-nums", valueClass)}>{children}</dd>
      {note && <dd className="m-0 text-xs font-bold text-muted-foreground">{note}</dd>}
    </div>
  );
}

type Props = { student: Student; today: string; onAssignSchedule: () => void };

/** Сводка слева: главное о ученике видно на любой вкладке. */
export function ProfileSummary({ student, today, onAssignSchedule }: Props) {
  const { notify } = useNotifier();
  const { schedule, payment, parent, exam } = student;
  const note = balanceNote(student);
  const tariff =
    payment.model === "package" && payment.package
      ? { value: students.payment.package, note: students.sheet.tariff.package(payment.package.left, payment.package.lessons) }
      : { value: students.payment.perLesson, note: students.payment.pricePerLesson(formatRubles(payment.pricePerLesson)) };

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(student.id));
      notify(students.sheet.inviteCopied);
    } catch {
      // Буфер обмена недоступен — ссылку можно взять в окне «Новый ученик».
    }
  };

  return (
    <div aria-label={text.label} role="region">
      <Group title={text.next}>
        <p className={cx("m-0 font-[family-name:var(--font-display)] text-xl leading-tight font-black", !student.nextLesson && "text-muted-foreground")}>
          {student.nextLesson ? nextLessonText(student, today) : text.noNext}
        </p>
        {schedule.timesPerWeek > 0 ? (
          <p className="m-0 text-sm font-semibold text-muted-foreground tabular-nums">
            {students.sheet.overview.scheduleLine(formatTimesPerWeek(schedule.timesPerWeek), schedule.days.join(", "), schedule.time, schedule.durationMin)}
          </p>
        ) : (
          <span>
            <Button size="sm" icon={CalendarPlus} onClick={onAssignSchedule}>
              {students.sheet.assignSchedule}
            </Button>
          </span>
        )}
      </Group>

      <Group title={text.payment}>
        <dl className="m-0 grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <Fact label={students.profile.payments.balance} valueClass={balanceClass(student.balance)} note={note?.text}>
              {formatBalance(student.balance)}
            </Fact>
          </div>
          <Fact label={text.tariff} note={tariff.note}>
            {tariff.value}
          </Fact>
          <Fact label={text.done}>{student.lessonsCount}</Fact>
        </dl>
      </Group>

      {exam && (
        <Group title={text.exam}>
          <div className="grid gap-2">
            <div className="flex items-baseline justify-between gap-2">
              <b className="text-base font-extrabold">{student.goal.split(" · ")[0]}</b>
              <span className="text-sm font-bold text-muted-foreground tabular-nums">{text.examLine(exam.daysLeft)}</span>
            </div>
            <ProgressBar percent={exam.readiness} label={text.readiness(exam.readiness)} />
            <span className="text-sm font-semibold text-muted-foreground tabular-nums">
              {text.readiness(exam.readiness)} · {text.weak(exam.weak)}
            </span>
          </div>
        </Group>
      )}

      <Group title={text.contacts}>
        <dl className="m-0 grid gap-4">
          {parent && (
            <Fact label={text.parent} note={parent.phone}>
              {[parent.relation, parent.name].filter(Boolean).join(": ")}
            </Fact>
          )}
          <Fact label={text.source}>{student.source}</Fact>
        </dl>
        {!student.telegramConnected && (
          <span>
            <Button size="sm" icon={Copy} onClick={() => void copyInvite()}>
              {text.copyInvite}
            </Button>
          </span>
        )}
      </Group>
    </div>
  );
}
