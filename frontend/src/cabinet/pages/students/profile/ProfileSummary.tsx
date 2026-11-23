import { CalendarClock, CalendarPlus, Copy, MessageCircle, Phone, Target, Wallet, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import type { Student } from "../../../mocks/types";
import { formatRubles } from "../../../model/format";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";
import { Ring } from "../../learn/Ring";
import { inviteLink } from "../NewStudentDialog";
import { balanceNote, formatBalance, nextLessonText } from "../StudentsTable";

const students = cabinet.teacher.students;
const text = students.profile.summary;

type BlockTone = "blue" | "pink" | "mint" | "lavender" | "plain";

const blockTones: Record<BlockTone, string> = {
  blue: "glass-blue",
  pink: "glass [--glass-bg:color-mix(in_srgb,var(--vibe-pink)_70%,transparent)]",
  mint: "glass [--glass-bg:color-mix(in_srgb,var(--vibe-mint)_70%,transparent)]",
  lavender: "glass [--glass-bg:color-mix(in_srgb,var(--vibe-lavender)_70%,transparent)]",
  plain: "glass",
};

/** Блок сводки на матовом стекле: цвет — по смыслу (урок — синий, долг — розовый, предоплата — мятный). */
function Block({ icon: Icon, title, tone = "plain", children }: { icon: LucideIcon; title: string; tone?: BlockTone; children: ReactNode }) {
  const onBlue = tone === "blue";
  return (
    <section className={cx("relative isolate grid gap-3 overflow-hidden rounded-2xl p-4", blockTones[tone])}>
      {onBlue && <span className="pointer-events-none absolute -top-12 -right-10 -z-10 size-36 rounded-full bg-[var(--color-lime)] opacity-25 blur-3xl" aria-hidden="true" />}
      <h3 className={cx("m-0 flex items-center gap-2 text-xs font-extrabold tracking-wide uppercase", onBlue ? "text-white/80" : "text-muted-foreground")}>
        <Icon size={15} aria-hidden="true" />
        {title}
      </h3>
      {children}
    </section>
  );
}

function MiniStat({ label, value, note }: { label: string; value: ReactNode; note?: string }) {
  return (
    <div className="grid min-w-0 content-start gap-0.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <b className="truncate text-sm font-extrabold tabular-nums">{value}</b>
      {note && <span className="truncate text-xs font-semibold text-muted-foreground tabular-nums">{note}</span>}
    </div>
  );
}

type Props = { student: Student; today: string; onAssignSchedule: () => void };

/** Сводка справа: урок, оплата, экзамен, контакты — на матовом стекле, главное видно с любой вкладки (STUDENTS-13). */
export function ProfileSummary({ student, today, onAssignSchedule }: Props) {
  const { notify } = useNotifier();
  const { schedule, payment, parent, exam } = student;
  const note = balanceNote(student);
  const pack = payment.model === "package" ? payment.package : undefined;
  const mixed = schedule.time === students.mixedTime;

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(student.id));
      notify(students.sheet.inviteCopied);
    } catch {
      // Буфер обмена недоступен — ссылку можно взять в окне «Новый ученик».
    }
  };

  return (
    <div className="grid gap-3" aria-label={text.label} role="region">
      <Block icon={CalendarClock} title={text.next} tone="blue">
        <p className={cx("m-0 font-[family-name:var(--font-display)] text-xl leading-tight font-black", !student.nextLesson && "text-white/70")}>
          {student.nextLesson ? nextLessonText(student, today) : text.noNext}
        </p>
        {schedule.timesPerWeek > 0 ? (
          <div className="grid gap-2">
            <ul className="m-0 flex list-none gap-1 p-0" aria-label={text.daysLabel}>
              {cabinet.weekdays.map((day) => {
                const on = schedule.days.includes(day);
                return (
                  <li
                    key={day}
                    className={cx("grid h-7 flex-1 place-items-center rounded-md text-[11px] font-extrabold", on ? "bg-white text-primary" : "bg-white/12 text-white/70")}
                    aria-label={on ? day : undefined}
                    aria-hidden={on ? undefined : true}
                  >
                    {day}
                  </li>
                );
              })}
            </ul>
            <span className="text-sm font-bold text-white/80 tabular-nums">
              {mixed ? text.mixedTime : schedule.time} · {text.duration(schedule.durationMin)}
            </span>
          </div>
        ) : (
          <span>
            <Button size="sm" icon={CalendarPlus} onClick={onAssignSchedule}>
              {students.sheet.assignSchedule}
            </Button>
          </span>
        )}
      </Block>

      <Block icon={Wallet} title={text.payment} tone={student.balance < 0 ? "pink" : student.balance > 0 ? "mint" : "plain"}>
        <div className="grid gap-1">
          <b className={cx("font-[family-name:var(--font-display)] text-xl leading-tight font-black tabular-nums", student.balance < 0 ? "text-destructive" : student.balance > 0 ? "text-success" : "")}>{formatBalance(student.balance)}</b>
          {note && <span className={cx("text-xs font-bold", note.warn ? "text-[var(--cab-warn)]" : "text-muted-foreground")}>{note.text}</span>}
        </div>
        <div className="grid grid-cols-2 gap-3 border-t border-black/5 pt-3">
          <MiniStat
            label={text.tariff}
            value={pack ? students.payment.package : students.payment.perLesson}
            note={pack ? text.lessonsLeft(pack.left, pack.lessons) : students.payment.pricePerLesson(formatRubles(payment.pricePerLesson))}
          />
          <MiniStat label={text.doneShort} value={student.lessonsCount} note={text.lessonsUnit} />
        </div>
      </Block>

      {exam && (
        <Block icon={Target} title={text.exam} tone="lavender">
          <div className="flex items-center gap-3">
            <Ring value={exam.readiness} size={56} stroke={6} label={text.readiness(exam.readiness)}>
              <b className="text-sm font-black tabular-nums">{exam.readiness}%</b>
            </Ring>
            <div className="grid gap-0.5">
              <b className="text-base font-extrabold">{student.goal.split(" · ")[0]}</b>
              <span className="text-sm font-semibold text-muted-foreground tabular-nums">{text.examLine(exam.daysLeft)}</span>
            </div>
          </div>
          {exam.weak.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-muted-foreground">{text.weakLabel}:</span>
              {exam.weak.map((number) => (
                <span key={number} className="rounded-md bg-[var(--cab-bad-soft)] px-2 py-0.5 text-xs font-extrabold text-destructive">
                  №{number}
                </span>
              ))}
            </div>
          )}
        </Block>
      )}

      <Block icon={MessageCircle} title={text.contacts}>
        {parent && (
          <div className="flex items-center gap-3">
            <span className="grid size-10 flex-none place-items-center rounded-full bg-secondary text-sm font-extrabold" aria-hidden="true">
              {parent.name
                .split(" ")
                .map((part) => part[0])
                .join("")
                .slice(0, 2)}
            </span>
            <div className="grid min-w-0 flex-1">
              <span className="text-xs font-bold text-muted-foreground">{parent.relation}</span>
              <b className="truncate text-sm font-extrabold">{parent.name}</b>
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">{parent.phone}</span>
            </div>
            <a
              href={`tel:${parent.phone.replace(/[^\d+]/g, "")}`}
              aria-label={text.call(parent.phone)}
              className="grid size-9 flex-none place-items-center rounded-full bg-primary text-primary-foreground no-underline transition-opacity hover:opacity-90"
            >
              <Phone size={16} aria-hidden="true" />
            </a>
          </div>
        )}
        <div className="flex flex-wrap gap-1.5">
          <span className="rounded-full bg-white/70 px-2.5 py-1 text-xs font-bold text-muted-foreground">{text.sourceChip(student.source)}</span>
        </div>
        {!student.telegramConnected && (
          <span>
            <Button size="sm" icon={Copy} onClick={() => void copyInvite()}>
              {text.copyInvite}
            </Button>
          </span>
        )}
      </Block>
    </div>
  );
}
