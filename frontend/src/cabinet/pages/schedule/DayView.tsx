import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { ScheduleData, ScheduleLesson } from "../../mocks/types";
import { addDays } from "../../model/dates";
import { formatSigned } from "../../model/format";
import { isPast, lessonsOn, nextLesson } from "../../model/lessons";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { Tabs } from "../../ui/Tabs";
import { lessonTime, PaymentBadge, RecurringIcon } from "./LessonMeta";
import { lessonColorStyle, type ColorMode } from "./scheduleStyle";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;

type Props = {
  data: ScheduleData;
  lessons: ScheduleLesson[];
  date: string;
  colorMode: ColorMode;
  onDate: (date: string) => void;
  onOpen: (lesson: ScheduleLesson) => void;
};

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="m-0 text-sm font-semibold">{value}</dd>
    </div>
  );
}

export function DayView({ data, lessons, date, colorMode, onDate, onOpen }: Props) {
  const { notifySoon } = useNotifier();
  const { today, now } = data;
  const dayLessons = lessonsOn(lessons, date);
  const focus = date === today ? nextLesson(dayLessons, today, now) : (dayLessons[0] ?? null);
  const focusStudent = focus ? getStudent(focus.studentId) : null;
  const tomorrow = addDays(today, 1);

  return (
    <>
      <Tabs
        label={text.viewLabel}
        items={[
          { id: today, label: text.today },
          { id: tomorrow, label: text.tomorrow },
        ]}
        selectedId={date === today || date === tomorrow ? date : ""}
        onSelect={onDate}
      />
      <div className={styles.dayLayout}>
        <div className={styles.listStack}>
          {dayLessons.length === 0 && <p className="m-0 rounded-xl border bg-card p-6 text-center text-sm font-semibold text-muted-foreground">{text.noLessons}</p>}
          {dayLessons.map((lesson) => {
            const student = getStudent(lesson.studentId);
            const past = isPast(lesson, today, now);
            return (
              <button
                key={lesson.id}
                type="button"
                className={cx(styles.lessonRow, past && styles.lessonRowPast)}
                style={lessonColorStyle(student, colorMode)}
                onClick={() => onOpen(lesson)}
              >
                <span className={styles.rowTime}>{lessonTime(lesson)}</span>
                <span className={styles.rowAvatar}>
                  <Avatar initials={student.initials} color={student.color} />
                </span>
                <span className={styles.rowText}>
                  <b>{student.name}</b>
                  <span>{student.subject}</span>
                </span>
                {lesson.recurring && <RecurringIcon />}
                <PaymentBadge payment={student.payment} />
              </button>
            );
          })}
        </div>

        <Card title={text.next.title}>
          {focus && focusStudent ? (
            <div className="grid gap-4">
              <div className="flex items-center gap-3">
                <Avatar initials={focusStudent.initials} color={focusStudent.color} />
                <div className="min-w-0">
                  <b className="block truncate text-sm">{focusStudent.name}</b>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                    {lessonTime(focus)} · {focusStudent.subject}
                  </span>
                </div>
              </div>
              <dl className="m-0 grid gap-3">
                <Fact label={text.next.topic} value={focusStudent.lastTopic} />
                <Fact label={text.next.homework} value={focusStudent.homework} />
                <Fact label={text.next.balance} value={formatSigned(focusStudent.balanceKopecks)} />
                <Fact label={text.next.note} value={focusStudent.note} />
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => notifySoon(text.lesson.join)}>
                  {text.lesson.join}
                </Button>
                <Button onClick={() => notifySoon(text.lesson.move)}>{text.lesson.move}</Button>
              </div>
            </div>
          ) : (
            <p className="m-0 text-sm font-semibold text-muted-foreground">{text.next.empty}</p>
          )}
        </Card>
      </div>
    </>
  );
}
