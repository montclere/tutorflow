import { BookOpen, CalendarClock, ClipboardList, NotebookPen, Repeat, UserRound, XCircle } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { lessonsApi, lessonsErrorCode, toScheduleLesson, type LiveLesson } from "../../../api/lessons";
import type { TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { lessonsText } from "../../../content/lessons.ru";
import { cardColor } from "../../../model/cardColor";
import { formatCountdown } from "../../../model/format";
import { lessonPhase } from "../../../model/lessons";
import { initialsOf } from "../../../model/newStudent";
import { toMinutes } from "../../../model/time";
import { nowIn } from "../../../model/zoned";
import { Button } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Sheet, SheetContent, SheetFooter } from "@/shared/ui/kit/sheet";
import { liveStudentsHref } from "../../students/live/useLiveStudentsUrl";
import { lessonTime } from "../LessonMeta";
import { LessonDetailsHeader, LessonDetailsRow, LessonMaterialsSection, useLessonFocus } from "../LessonDetails";
import styles from "../lesson-details.module.css";
import { LessonPanels, type Panel } from "./LessonPanels";

const schedule = cabinet.teacher.schedule;
const text = schedule.live;

type Props = {
  lesson: LiveLesson | null;
  card: TeacherCard | null;
  timeZone: string;
  onClose: () => void;
  onChanged: (lesson: LiveLesson) => void;
  onConflict: () => void;
};

type Asking = "cancel" | "noShow" | null;

/** Действия зависят от состояния и времени урока: отмена — до начала, отметка — после окончания (LES, SCHEDULE-5). */
export function LiveLessonSheet({ lesson, card, timeZone, onClose, onChanged, onConflict }: Props) {
  const { notify } = useNotifier();
  const focus = useLessonFocus();
  const [panel, setPanel] = useState<Panel>(null);
  const actionsRef = useRef<HTMLDivElement | null>(null);
  const [asking, setAsking] = useState<Asking>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const close = () => {
    setAsking(null);
    setPanel(null);
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

  const countdown = view && lesson?.status === "scheduled" && phase === "upcoming" && view.date === today ? formatCountdown(toMinutes(view.start) - toMinutes(now)) : lesson?.status === "scheduled" && phase === "live" ? schedule.lesson.live : null;
  useEffect(() => { if (panel || asking) actionsRef.current?.scrollIntoView({ block: "start" }); }, [panel, asking]);

  return <Sheet open={lesson !== null} onOpenChange={(open) => !open && close()}>
    <SheetContent className={styles.panel} overlayClassName={styles.overlay} {...focus}>
      {lesson && view && <>
        <div className={styles.scroll}>
          <LessonDetailsHeader date={view.date} time={lessonTime(view)} countdown={countdown} name={name} goal={card?.goal ?? undefined} initials={initialsOf(name)} color={cardColor(lesson.cardId)} studentHref={liveStudentsHref(card?.status === "archived" ? "archived" : "active", lesson.cardId)}>
            <span className={styles.chip}><UserRound size={15} aria-hidden="true" />{schedule.types.individual}</span>
            {lesson.seriesId && <span className={styles.chip}><Repeat size={15} aria-hidden="true" />{schedule.recurring}</span>}
            <span className={styles.chip}>{schedule.outcome[lesson.status]}</span>
          </LessonDetailsHeader>
          <div className={styles.body}>
            <LessonDetailsRow icon={BookOpen} label={schedule.lesson.topicLabel}>{lesson.title || schedule.lesson.noTopic}</LessonDetailsRow>
            {lesson.description && <LessonDetailsRow icon={BookOpen} label={lessonsText.edit.description}>{lesson.description}</LessonDetailsRow>}
            <LessonDetailsRow icon={ClipboardList} label={schedule.next.homework}><span className={styles.unavailable}>{schedule.lesson.noHomeworkApi}</span></LessonDetailsRow>
            {lesson.preparation && <LessonDetailsRow icon={ClipboardList} label={text.facts.preparation}>{lesson.preparation}</LessonDetailsRow>}
            <LessonMaterialsSection lessonId={lesson.id} />
            <LessonDetailsRow icon={NotebookPen} label={text.facts.note} note>
              {lesson.privateNote || schedule.lesson.noLessonNote}
              <button type="button" className="mt-2 block border-0 bg-transparent p-0 text-sm font-bold text-primary underline" onClick={() => setPanel("edit")}>{lessonsText.edit.open}</button>
            </LessonDetailsRow>
            {lesson.outcomeReason && <LessonDetailsRow icon={NotebookPen} label={text.facts.reason}>{lesson.outcomeReason}</LessonDetailsRow>}
          </div>
          <div ref={actionsRef} className={styles.extra}>
            {asking && <label className="grid gap-1.5 px-4 pt-4">
              <span className="text-xs font-bold text-muted-foreground">{asking === "cancel" ? text.sheet.cancelReason : text.sheet.noShowReason}<span className="font-semibold"> · {text.sheet.cancelReasonHint}</span></span>
              <textarea value={reason} rows={2} maxLength={500} className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-base" onChange={(event) => setReason(event.target.value)} />
            </label>}
            <LessonPanels lesson={lesson} timeZone={timeZone} upcoming={phase === "upcoming"} onChanged={onChanged} onReload={onConflict} onClose={close} panel={panel} onPanelChange={setPanel} />
          </div>
        </div>
        <SheetFooter className={styles.footer}>
          {lesson.status === "scheduled" && phase !== "ended" && !asking && <>
            <Button variant="primary" className={styles.primary} disabled>{schedule.lesson.joinLesson}</Button>
            <p className="col-span-2 m-0 text-center text-xs text-muted-foreground">{schedule.lesson.noLessonLink}</p>
          </>}
          {lesson.status === "scheduled" && phase === "upcoming" && !asking && <>
            <Button icon={CalendarClock} onClick={() => setPanel(panel === "move" ? null : "move")}>{schedule.lesson.move}</Button>
            <Button icon={XCircle} onClick={() => setAsking("cancel")}>{schedule.lesson.cancel}</Button>
          </>}
          {lesson.status === "scheduled" && phase === "live" && <p className="col-span-2 m-0 text-sm font-semibold text-muted-foreground">{text.sheet.markLater}</p>}
          {lesson.status === "scheduled" && phase === "ended" && !asking && <>
            <Button variant="primary" disabled={busy} onClick={() => void run(() => lessonsApi.attendance(lesson, "completed"))}>{text.sheet.completed}</Button>
            <Button disabled={busy} onClick={() => setAsking("noShow")}>{text.sheet.noShow}</Button>
          </>}
          {asking && <>
            <Button disabled={busy} onClick={() => setAsking(null)}>{text.sheet.keep}</Button>
            <Button variant="primary" disabled={busy} onClick={() => void run(() => asking === "cancel" ? lessonsApi.cancel(lesson, reason) : lessonsApi.attendance(lesson, "no_show", reason))}>{asking === "cancel" ? text.sheet.confirmCancel : text.sheet.noShow}</Button>
          </>}
          {(lesson.status === "completed" || lesson.status === "no_show") && <Button className={styles.primary} disabled={busy} onClick={() => void run(() => lessonsApi.resetAttendance(lesson))}>{text.sheet.reset}</Button>}
          {lesson.status === "cancelled" && phase === "upcoming" && <Button variant="primary" className={styles.primary} disabled={busy} onClick={() => void run(() => lessonsApi.restore(lesson))}>{text.sheet.restore}</Button>}
        </SheetFooter>
      </>}
    </SheetContent>
  </Sheet>;
}
