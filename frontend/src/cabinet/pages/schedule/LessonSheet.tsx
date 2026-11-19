import { BookOpenText, ClipboardText, NotePencil, Repeat } from "@phosphor-icons/react";
import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getSchedule, getStudent } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { formatLongDay } from "../../model/dates";
import { formatCountdown, formatRubles, formatSigned } from "../../model/format";
import { lessonPhase } from "../../model/lessons";
import { paymentStatus } from "../../model/students";
import { toMinutes } from "../../model/time";
import { Avatar } from "../../ui/Avatar";
import { CabinetLink } from "../../ui/CabinetLink";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetTitle } from "@/shared/ui/kit/sheet";
import { studentsHref } from "../students/useStudentsUrl";
import { lessonTime } from "./LessonMeta";

const text = cabinet.teacher.schedule;
const GOOD = 0.8;

type Props = { lesson: ScheduleLesson | null; onClose: () => void };

function Prepare({ icon: Icon, label, value, badge }: { icon: typeof BookOpenText; label: string; value: string; badge?: ReactNode }) {
  return (
    <div className="glass flex items-start gap-3 rounded-2xl p-3.5">
      <span className="grid size-10 flex-none place-items-center rounded-xl bg-accent text-primary" aria-hidden="true">
        <Icon size={22} />
      </span>
      <div className="grid min-w-0 flex-1 gap-0.5">
        <span className="text-xs font-bold text-muted-foreground">{label}</span>
        <b className="text-base leading-snug font-extrabold">{value}</b>
      </div>
      {badge}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="glass grid gap-0.5 rounded-2xl px-3 py-2.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <b className={cx("font-[family-name:var(--font-display)] text-lg leading-tight font-black tabular-nums", tone)}>{value}</b>
    </div>
  );
}

/**
 * Карточка урока в демо-расписании (VIBE-17): шапка на синем стекле — время, дата, отсчёт, ученик;
 * ниже — «К уроку» (прошлая тема, ДЗ со статусом), баланс и заметка; действия зависят от времени (SCHEDULE-5).
 */
export function LessonSheet({ lesson, onClose }: Props) {
  const { notifySoon } = useNotifier();
  const student = lesson ? getStudent(lesson.studentId) : null;

  const { today, now } = getSchedule();
  const phase = lesson ? lessonPhase(lesson, today, now) : "upcoming";

  const act = (label: string) => {
    notifySoon(label);
    onClose();
  };

  const join = () => {
    if (lesson?.link) window.open(lesson.link, "_blank", "noopener,noreferrer");
    else act(text.lesson.join);
  };

  const last = student?.recentLessons[0];
  const homework = last?.homework ?? null;
  const countdown =
    lesson && phase === "upcoming" && lesson.date === today ? formatCountdown(toMinutes(lesson.start) - toMinutes(now)) : phase === "live" ? text.lesson.live : phase === "ended" ? text.lesson.ended : null;
  const payment = student ? paymentStatus(student) : "paid";
  const balanceTone = !student || student.balance === 0 ? undefined : student.balance < 0 ? "text-destructive" : "text-success";

  return (
    <Sheet open={lesson !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto sm:max-w-md [&>button:last-child]:top-6 [&>button:last-child]:right-6 [&>button:last-child]:z-10 [&>button:last-child]:text-white">
        {lesson && student && (
          <>
            <header className="glass-blue relative isolate m-3 mb-0 overflow-hidden rounded-3xl p-5 pr-12">
              <span className="pointer-events-none absolute -top-16 -right-10 -z-10 size-48 rounded-full bg-[var(--color-lime)] opacity-25 blur-3xl" aria-hidden="true" />
              <span className="pointer-events-none absolute -bottom-20 left-1/4 -z-10 size-52 rounded-full bg-[#5fe0ff] opacity-20 blur-3xl" aria-hidden="true" />
              <SheetDescription className="m-0 text-sm font-bold text-white/80">{formatLongDay(lesson.date)}</SheetDescription>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="font-[family-name:var(--font-display)] text-[34px] leading-none font-black tabular-nums">{lessonTime(lesson)}</span>
                {countdown && <span className="rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-extrabold backdrop-blur-md">{countdown}</span>}
              </div>
              <div className="mt-4 flex items-center gap-3">
                <Avatar initials={student.initials} color={student.color} />
                <div className="grid min-w-0">
                  <SheetTitle className="m-0 truncate text-lg font-extrabold text-white">{student.name}</SheetTitle>
                  <span className="truncate text-sm font-semibold text-white/80">{student.goal}</span>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {[lesson.groupTitle ?? text.types[lesson.type], text.payFull[payment]].map((chip, index) => (
                  <span key={chip} className={cx("rounded-full px-2.5 py-1 text-xs font-extrabold", index === 1 && payment !== "paid" ? "bg-highlight text-highlight-foreground" : "bg-white/15")}>
                    {chip}
                  </span>
                ))}
                {lesson.recurring && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs font-extrabold">
                    <Repeat size={13} aria-hidden="true" />
                    {text.recurring}
                  </span>
                )}
              </div>
            </header>

            <div className="grid gap-3 p-4">
              <h3 className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">{text.lesson.prepare}</h3>
              <Prepare icon={BookOpenText} label={text.next.topic} value={last?.topic ?? text.next.none} />
              <Prepare
                icon={ClipboardText}
                label={text.next.homework}
                value={homework?.title ?? text.next.none}
                badge={
                  homework && (
                    <span
                      className={cx(
                        "flex-none rounded-full px-2.5 py-1 text-xs font-extrabold tabular-nums",
                        homework.done === null
                          ? "bg-[var(--cab-bad-soft)] text-destructive"
                          : homework.done / homework.total >= GOOD
                            ? "bg-[var(--cab-ok-soft)] text-success"
                            : "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]",
                      )}
                    >
                      {homework.done === null ? text.lesson.homeworkMissing : text.lesson.homeworkDone(homework.done, homework.total)}
                    </span>
                  )
                }
              />
              <div className="grid grid-cols-3 gap-2">
                <Stat label={text.next.balance} value={student.balance === 0 ? formatRubles(0) : formatSigned(student.balance)} tone={balanceTone} />
                <Stat label={text.lesson.lessonsDone} value={String(student.lessonsCount)} />
                <Stat label={cabinet.teacher.schedule.create.duration} value={text.lesson.duration(lesson.durationMin)} />
              </div>
              {student.note && (
                <div className="flex gap-3 rounded-2xl bg-[var(--vibe-peach)] p-3.5">
                  <NotePencil size={22} className="flex-none text-[#ff8a3d]" aria-hidden="true" />
                  <div className="grid gap-0.5">
                    <span className="text-xs font-bold text-muted-foreground">{text.next.note}</span>
                    <p className="m-0 text-sm font-semibold">{student.note}</p>
                  </div>
                </div>
              )}
              <CabinetLink
                href={studentsHref(student.status, student.id)}
                className="inline-flex items-center gap-1.5 justify-self-start text-sm font-bold text-primary no-underline hover:underline"
              >
                {text.lesson.studentCard}
                <ArrowRight size={15} aria-hidden="true" />
              </CabinetLink>
            </div>

            {/* Набор действий зависит от времени урока (SCHEDULE-5). */}
            <SheetFooter className="sticky bottom-0 mt-auto grid grid-cols-2 gap-2 border-t bg-background/90 backdrop-blur">
              {phase !== "ended" && (
                <Button variant="primary" onClick={join} className={cx("h-12 text-base", phase === "upcoming" && "col-span-2")}>
                  {text.lesson.joinLesson}
                </Button>
              )}
              {phase === "upcoming" && (
                <>
                  <Button className="h-11" onClick={() => act(text.lesson.move)}>
                    {text.lesson.move}
                  </Button>
                  <Button className="h-11" onClick={() => act(text.lesson.cancel)}>
                    {text.lesson.cancel}
                  </Button>
                </>
              )}
              {phase !== "upcoming" && (
                <Button variant="lime" onClick={() => act(text.lesson.done)} className={cx("h-12 text-base", phase === "ended" && "col-span-2")}>
                  {text.lesson.markDone}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
