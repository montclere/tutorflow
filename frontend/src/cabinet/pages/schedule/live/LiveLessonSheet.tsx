import { Repeat } from "lucide-react";
import { useState } from "react";
import { lessonsApi, lessonsErrorCode, toScheduleLesson, type LiveLesson } from "../../../api/lessons";
import type { TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { lessonsText } from "../../../content/lessons.ru";
import { cardColor } from "../../../model/cardColor";
import { formatLongDay } from "../../../model/dates";
import { lessonPhase } from "../../../model/lessons";
import { initialsOf } from "../../../model/newStudent";
import { nowIn } from "../../../model/zoned";
import { Avatar } from "../../../ui/Avatar";
import { Button } from "../../../ui/Button";
import { CabinetLink } from "../../../ui/CabinetLink";
import { useNotifier } from "../../../ui/Notifications";
import { Pill } from "../../../ui/Pill";
import { Separator } from "@/shared/ui/kit/separator";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/kit/sheet";
import { liveStudentsHref } from "../../students/live/useLiveStudentsUrl";
import { lessonTime } from "../LessonMeta";
import { LessonPanels } from "./LessonPanels";

const schedule = cabinet.teacher.schedule;
const text = schedule.live;

const statusTone = { scheduled: "blue", completed: "ok", no_show: "warn", cancelled: "grey" } as const;

type Props = {
  lesson: LiveLesson | null;
  card: TeacherCard | null;
  timeZone: string;
  onClose: () => void;
  onChanged: (lesson: LiveLesson) => void;
  onConflict: () => void;
};

type Asking = "cancel" | "noShow" | null;

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="m-0 text-sm font-semibold whitespace-pre-line">{value}</dd>
    </div>
  );
}

/** Действия зависят от состояния и времени урока: отмена — до начала, отметка — после окончания (LES, SCHEDULE-5). */
export function LiveLessonSheet({ lesson, card, timeZone, onClose, onChanged, onConflict }: Props) {
  const { notify } = useNotifier();
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setAsking(null);
    setReason("");
    onClose();
  };

  const run = async (operation: () => Promise<LiveLesson>) => {
    if (busy) return;
    setBusy(true);
    try {
      const changed = await operation();
      onChanged(changed);
      notify(text.sheet.done[changed.status]);
      setAsking(null);
      setReason("");
    } catch (error) {
      const code = lessonsErrorCode(error);
      notify(text.errors[code]);
      if (code === "versionConflict" || code === "stateConflict") onConflict();
    } finally {
      setBusy(false);
    }
  };

  const view = lesson ? toScheduleLesson(lesson, timeZone) : null;
  const { today, now } = nowIn(timeZone);
  const phase = view ? lessonPhase(view, today, now) : "upcoming";
  const name = card?.name ?? text.unknownStudent;

  return (
    <Sheet open={lesson !== null} onOpenChange={(open) => !open && close()}>
      <SheetContent className="gap-0 overflow-y-auto">
        {lesson && view && (
          <>
            <SheetHeader className="gap-3 pr-12">
              <div className="flex items-center gap-3">
                <Avatar initials={initialsOf(name)} color={cardColor(lesson.cardId)} />
                <div className="min-w-0">
                  <SheetTitle className="m-0 text-base font-extrabold">{name}</SheetTitle>
                  <SheetDescription className="m-0 text-sm tabular-nums">
                    {formatLongDay(view.date)} · {lessonTime(view)}
                  </SheetDescription>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Pill tone={statusTone[lesson.status]}>{schedule.outcome[lesson.status]}</Pill>
                {lesson.seriesId && (
                  <Pill tone="grey">
                    <Repeat size={12} aria-hidden="true" />
                    {schedule.recurring}
                  </Pill>
                )}
              </div>
            </SheetHeader>
            <Separator />
            <dl className="m-0 grid gap-4 p-4">
              <Fact label={text.facts.title} value={`${lesson.title} · ${schedule.lesson.duration(lesson.durationMinutes)}`} />
              {lesson.description && <Fact label={lessonsText.edit.description} value={lesson.description} />}
              {lesson.preparation && <Fact label={text.facts.preparation} value={lesson.preparation} />}
              {lesson.privateNote && <Fact label={text.facts.note} value={lesson.privateNote} />}
              {lesson.outcomeReason && <Fact label={text.facts.reason} value={lesson.outcomeReason} />}
            </dl>
            <div className="px-4">
              <CabinetLink href={liveStudentsHref(card?.status === "archived" ? "archived" : "active", lesson.cardId)} className="text-sm font-bold text-primary underline-offset-4 hover:underline">
                {schedule.lesson.studentCard} →
              </CabinetLink>
            </div>

            {asking && (
              <label className="grid gap-1.5 px-4 pt-4">
                <span className="text-xs font-bold text-muted-foreground">
                  {asking === "cancel" ? text.sheet.cancelReason : text.sheet.noShowReason}
                  <span className="font-semibold"> · {text.sheet.cancelReasonHint}</span>
                </span>
                <textarea
                  value={reason}
                  rows={2}
                  maxLength={500}
                  className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base [font:inherit] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  onChange={(event) => setReason(event.target.value)}
                />
              </label>
            )}

            <SheetFooter className="mt-0 grid grid-cols-2 gap-2">
              {lesson.status === "scheduled" && phase === "upcoming" && !asking && (
                <Button className="col-span-2" onClick={() => setAsking("cancel")}>
                  {text.sheet.cancel}
                </Button>
              )}
              {lesson.status === "scheduled" && phase === "live" && <p className="col-span-2 m-0 text-sm font-semibold text-muted-foreground">{text.sheet.markLater}</p>}
              {lesson.status === "scheduled" && phase === "ended" && !asking && (
                <>
                  <Button variant="lime" disabled={busy} onClick={() => void run(() => lessonsApi.attendance(lesson, "completed"))}>
                    {text.sheet.completed}
                  </Button>
                  <Button disabled={busy} onClick={() => setAsking("noShow")}>
                    {text.sheet.noShow}
                  </Button>
                </>
              )}
              {asking && (
                <>
                  <Button disabled={busy} onClick={() => setAsking(null)}>
                    {text.sheet.keep}
                  </Button>
                  <Button
                    variant="primary"
                    disabled={busy}
                    onClick={() => void run(() => (asking === "cancel" ? lessonsApi.cancel(lesson, reason) : lessonsApi.attendance(lesson, "no_show", reason)))}
                  >
                    {asking === "cancel" ? text.sheet.confirmCancel : text.sheet.noShow}
                  </Button>
                </>
              )}
              {(lesson.status === "completed" || lesson.status === "no_show") && (
                <Button className="col-span-2" disabled={busy} onClick={() => void run(() => lessonsApi.resetAttendance(lesson))}>
                  {text.sheet.reset}
                </Button>
              )}
              {lesson.status === "cancelled" && phase === "upcoming" && (
                <Button variant="primary" className="col-span-2" disabled={busy} onClick={() => void run(() => lessonsApi.restore(lesson))}>
                  {text.sheet.restore}
                </Button>
              )}
            </SheetFooter>
            <div className="pb-6">
              <LessonPanels lesson={lesson} timeZone={timeZone} upcoming={phase === "upcoming"} onChanged={onChanged} onReload={onConflict} onClose={close} />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
