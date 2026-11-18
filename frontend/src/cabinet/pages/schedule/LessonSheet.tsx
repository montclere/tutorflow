import { Repeat } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { getSchedule, getStudent } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { formatLongDay } from "../../model/dates";
import { formatRubles, formatSigned } from "../../model/format";
import { lessonPhase } from "../../model/lessons";
import { paymentStatus } from "../../model/students";
import { Avatar } from "../../ui/Avatar";
import { CabinetLink } from "../../ui/CabinetLink";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { Separator } from "@/shared/ui/kit/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/kit/sheet";
import { studentsHref } from "../students/useStudentsUrl";
import { lessonTime, PaymentBadge } from "./LessonMeta";

const text = cabinet.teacher.schedule;

type Props = { lesson: ScheduleLesson | null; onClose: () => void };

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="m-0 text-sm font-semibold">{value}</dd>
    </div>
  );
}

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

  return (
    <Sheet open={lesson !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0 overflow-y-auto">
        {lesson && student && (
          <>
            <SheetHeader className="gap-3 pr-12">
              <div className="flex items-center gap-3">
                <Avatar initials={student.initials} color={student.color} />
                <div className="min-w-0">
                  <SheetTitle className="m-0 text-base font-extrabold">{student.name}</SheetTitle>
                  <SheetDescription className="m-0 text-sm tabular-nums">
                    {formatLongDay(lesson.date)} · {lessonTime(lesson)}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone="blue">{lesson.groupTitle ?? text.types[lesson.type]}</Pill>
                <PaymentBadge payment={paymentStatus(student)} full />
                {lesson.recurring && (
                  <Pill tone="grey">
                    <Repeat size={12} aria-hidden="true" />
                    {text.recurring}
                  </Pill>
                )}
              </div>
            </SheetHeader>
            <Separator />
            <dl className="m-0 grid gap-4 p-4">
              <Field label={text.next.goal} value={`${student.goal} · ${text.lesson.duration(lesson.durationMin)}`} />
              <Field label={text.next.topic} value={student.recentLessons[0]?.topic ?? text.next.none} />
              <Field label={text.next.homework} value={student.recentLessons[0]?.homework?.title ?? text.next.none} />
              <Field label={text.next.balance} value={student.balance === 0 ? formatRubles(0) : formatSigned(student.balance)} />
              <Field label={text.next.note} value={student.note} />
            </dl>
            <div className="px-4">
              <CabinetLink
                href={studentsHref(student.status, student.id)}
                className="text-sm font-bold text-primary underline-offset-4 hover:underline"
              >
                {text.lesson.studentCard} →
              </CabinetLink>
            </div>
            {/* Набор действий зависит от времени урока (SCHEDULE-5). */}
            <SheetFooter className="grid grid-cols-2 gap-2">
              {phase !== "ended" && (
                <Button variant="primary" onClick={join} className={phase === "upcoming" ? "col-span-2" : undefined}>
                  {text.lesson.join}
                </Button>
              )}
              {phase === "upcoming" && (
                <>
                  <Button onClick={() => act(text.lesson.move)}>{text.lesson.move}</Button>
                  <Button onClick={() => act(text.lesson.cancel)}>{text.lesson.cancel}</Button>
                </>
              )}
              {phase !== "upcoming" && (
                <Button variant="lime" onClick={() => act(text.lesson.done)} className={phase === "ended" ? "col-span-2" : undefined}>
                  {text.lesson.done}
                </Button>
              )}
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
