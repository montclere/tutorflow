import { Repeat } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { formatLongDay } from "../../model/dates";
import { formatRubles, formatSigned } from "../../model/format";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { Separator } from "@/shared/ui/kit/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/kit/sheet";
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

  const act = (label: string) => {
    notifySoon(label);
    onClose();
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
                <PaymentBadge payment={student.payment} full />
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
              <Field label={cabinet.teacher.schedule.lesson.title} value={`${student.subject} · ${text.lesson.duration(lesson.durationMin)}`} />
              <Field label={text.next.topic} value={student.lastTopic} />
              <Field label={text.next.homework} value={student.homework} />
              <Field label={text.next.balance} value={student.balanceKopecks === 0 ? formatRubles(0) : formatSigned(student.balanceKopecks)} />
              <Field label={text.next.note} value={student.note} />
            </dl>
            <SheetFooter className="grid grid-cols-2 gap-2">
              <Button variant="primary" onClick={() => act(text.lesson.join)}>
                {text.lesson.join}
              </Button>
              <Button onClick={() => act(text.lesson.move)}>{text.lesson.move}</Button>
              <Button onClick={() => act(text.lesson.cancel)}>{text.lesson.cancel}</Button>
              <Button variant="lime" onClick={() => act(text.lesson.done)}>
                {text.lesson.done}
              </Button>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
