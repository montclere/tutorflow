import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { ScheduleData, ScheduleLesson } from "../../mocks/types";
import { formatLongDay } from "../../model/dates";
import { groupByDate, isPast } from "../../model/lessons";
import { Avatar } from "../../ui/Avatar";
import { cx } from "../../ui/cx";
import { lessonTime, PaymentBadge } from "./LessonMeta";
import { lessonColorStyle } from "./scheduleStyle";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;

type Props = {
  data: ScheduleData;
  lessons: ScheduleLesson[];
  filtered: boolean;
  onOpen: (lesson: ScheduleLesson) => void;
};

export function ListView({ data, lessons, filtered, onOpen }: Props) {
  const groups = groupByDate(lessons);

  if (groups.length === 0) {
    return <p className="m-0 rounded-xl border bg-card p-6 text-center text-sm font-semibold text-muted-foreground">{filtered ? text.emptyFiltered : text.emptyList}</p>;
  }

  return (
    <div className={styles.listGroups}>
      {groups.map((group) => (
        <section key={group.date}>
          <h2 className={styles.listDate}>{formatLongDay(group.date)}</h2>
          <div className={styles.listStack}>
            {group.lessons.map((lesson) => {
              const student = getStudent(lesson.studentId);
              const past = isPast(lesson, data.today, data.now);
              return (
                <button
                  key={lesson.id}
                  type="button"
                  className={cx(styles.lessonRow, past && styles.lessonRowPast)}
                  style={lessonColorStyle(student)}
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
                  {student.payment !== "paid" && <PaymentBadge payment={student.payment} />}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
