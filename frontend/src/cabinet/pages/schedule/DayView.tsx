import { cabinet } from "../../content/cabinet.ru";
import type { ScheduleData, ScheduleLesson } from "../../mocks/types";
import { isPast, lessonsOn, nextLesson } from "../../model/lessons";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { Card } from "../../ui/Card";
import { cx } from "../../ui/cx";
import { isCancelled, lessonLine, lessonTime, PaymentBadge, RowTime } from "./LessonMeta";
import { useSchedulePeople } from "./schedulePeople";
import { lessonColorStyle } from "./scheduleStyle";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;

type Props = {
  data: ScheduleData;
  lessons: ScheduleLesson[];
  date: string;
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

export function DayView({ data, lessons, date, onOpen }: Props) {
  const people = useSchedulePeople();
  const { today, now } = data;
  const dayLessons = lessonsOn(lessons, date);
  // Отменённый урок не может быть «ближайшим».
  const active = dayLessons.filter((lesson) => !isCancelled(lesson));
  const focus = date === today ? nextLesson(active, today, now) : (active[0] ?? null);
  const focusStudent = focus ? people.personOf(focus) : null;

  return (
    <>
      <div className={styles.dayLayout}>
        <div className={styles.listStack}>
          {dayLessons.length === 0 && <p className="m-0 rounded-xl border bg-card p-6 text-center text-sm font-semibold text-muted-foreground">{text.noLessons}</p>}
          {dayLessons.map((lesson) => {
            const student = people.personOf(lesson);
            const past = isPast(lesson, today, now);
            return (
              <button
                key={lesson.id}
                type="button"
                className={cx(styles.lessonRow, past && styles.lessonRowPast, isCancelled(lesson) && styles.cancelled)}
                style={lessonColorStyle(student)}
                onClick={() => onOpen(lesson)}
              >
                <RowTime lesson={lesson} className={styles.rowTime} />
                <span className={styles.rowAvatar}>
                  <Avatar initials={student.initials} color={student.color} />
                </span>
                <span className={styles.rowText}>
                  <b>{student.name}</b>
                  <span>{lessonLine(lesson, student.goal)}</span>
                </span>
                {student.payment && student.payment !== "paid" && <PaymentBadge payment={student.payment} />}
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
                    {lessonTime(focus)}
                    {focusStudent.goal && ` · ${focusStudent.goal}`}
                  </span>
                </div>
              </div>
              <dl className="m-0 grid gap-3">
                {people.factsOf(focus).map((fact) => (
                  <Fact key={fact.label} label={fact.label} value={fact.value} />
                ))}
              </dl>
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => onOpen(focus)}>
                  {text.lesson.open}
                </Button>
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
