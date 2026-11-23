import { BookOpen, CalendarClock, ClipboardList, NotebookPen, Repeat, UserRound, Wallet, XCircle } from "lucide-react";
import { cabinet } from "../../content/cabinet.ru";
import { getSchedule, getStudent } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { formatCountdown } from "../../model/format";
import { lessonPhase } from "../../model/lessons";
import { paymentStatus } from "../../model/students";
import { toMinutes } from "../../model/time";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Sheet, SheetContent, SheetFooter } from "@/shared/ui/kit/sheet";
import { studentsHref } from "../students/useStudentsUrl";
import { lessonTime } from "./LessonMeta";
import { LessonDetailsHeader, LessonDetailsRow, LessonMaterialsSection, useLessonFocus } from "./LessonDetails";
import styles from "./lesson-details.module.css";

const text = cabinet.teacher.schedule;
const GOOD = 0.8;
type Props = { lesson: ScheduleLesson | null; onClose: () => void };

/** Демо-панель: исходные сведения ученика подписаны по источнику; API-данные здесь не имитируются. */
export function LessonSheet({ lesson, onClose }: Props) {
  const { notifySoon } = useNotifier();
  const focus = useLessonFocus();
  const student = lesson ? getStudent(lesson.studentId) : null;
  const { today, now } = getSchedule();
  const phase = lesson ? lessonPhase(lesson, today, now) : "upcoming";
  const act = (label: string) => { notifySoon(label); onClose(); };
  const last = student?.recentLessons[0];
  const homework = last?.homework ?? null;
  const countdown = lesson && phase === "upcoming" && lesson.date === today ? formatCountdown(toMinutes(lesson.start) - toMinutes(now)) : phase === "live" ? text.lesson.live : null;
  const payment = student ? paymentStatus(student) : "paid";
  const cancelled = lesson?.status === "cancelled";
  const paymentLabel = student?.balance === 0 && payment === "paid" ? text.lesson.neutralBalance : text.payFull[payment];

  return <Sheet open={lesson !== null} onOpenChange={(open) => !open && onClose()}>
    <SheetContent className={styles.panel} overlayClassName={styles.overlay} {...focus}>
      {lesson && student && <>
        <div className={styles.scroll}>
          <LessonDetailsHeader date={lesson.date} time={lessonTime(lesson)} countdown={cancelled ? null : countdown} balance={student.balance} name={student.name} goal={student.goal} initials={student.initials} color={student.color} studentHref={studentsHref(student.status, student.id)}>
            <span className={styles.chip}><UserRound size={15} aria-hidden="true" />{lesson.groupTitle ?? text.types[lesson.type]}</span>
            {lesson.recurring && <span className={styles.chip}><Repeat size={15} aria-hidden="true" />{text.recurring}</span>}
            <span className={cx(styles.chip, student.balance > 0 ? styles.positive : student.balance < 0 ? styles.negative : styles.neutral)}><Wallet size={15} aria-hidden="true" />{paymentLabel}</span>
            {lesson.status && lesson.status !== "scheduled" && <span className={styles.chip}>{text.outcome[lesson.status]}</span>}
          </LessonDetailsHeader>
          <div className={styles.body}>
            <LessonDetailsRow icon={BookOpen} label={text.lesson.previousTopicLabel}>{last?.topic ?? text.next.none}</LessonDetailsRow>
            <LessonDetailsRow icon={ClipboardList} label={text.lesson.previousHomeworkLabel} aside={homework && <span className={cx(styles.badge, homework.done === null ? styles.negative : homework.done / homework.total >= GOOD ? styles.positive : styles.neutral)}>{homework.done === null ? text.lesson.homeworkMissing : text.lesson.homeworkDone(homework.done, homework.total)}</span>}>{homework?.title ?? text.next.none}</LessonDetailsRow>
            <LessonMaterialsSection lessonId={lesson.id} />
            {student.note && <LessonDetailsRow icon={NotebookPen} label={text.lesson.studentNote} note>{student.note}</LessonDetailsRow>}
          </div>
        </div>
        <SheetFooter className={styles.footer}>
          {!cancelled && phase !== "ended" && <>
            <Button variant="primary" className={styles.primary} disabled={!lesson.link} onClick={() => lesson.link && window.open(lesson.link, "_blank", "noopener,noreferrer")}>{text.lesson.joinLesson}</Button>
            {!lesson.link && <p className="col-span-2 m-0 text-center text-xs text-muted-foreground">{text.lesson.noLessonLink}</p>}
          </>}
          {!cancelled && phase === "upcoming" && <><Button icon={CalendarClock} onClick={() => act(text.lesson.move)}>{text.lesson.move}</Button><Button icon={XCircle} onClick={() => act(text.lesson.cancel)}>{text.lesson.cancel}</Button></>}
          {!cancelled && phase !== "upcoming" && <Button className={styles.primary} onClick={() => act(text.lesson.done)}>{text.lesson.markDone}</Button>}
        </SheetFooter>
      </>}
    </SheetContent>
  </Sheet>;
}
