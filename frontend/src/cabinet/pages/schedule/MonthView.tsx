import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { isSameMonth, monthGrid, parseDate } from "../../model/dates";
import { lessonsOn } from "../../model/lessons";
import { cx } from "../../ui/cx";
import { lessonColorStyle } from "./scheduleStyle";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;
const MAX_DOTS = 6;

type Props = {
  lessons: ScheduleLesson[];
  date: string;
  today: string;
  onPick: (date: string) => void;
};

export function MonthView({ lessons, date, today, onPick }: Props) {
  const weeks = monthGrid(date);

  return (
    <div className="overflow-hidden rounded-xl border bg-card" role="group" aria-label={text.monthLabel}>
      <div className={styles.monthHead} aria-hidden="true">
        {cabinet.weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className={styles.monthGrid}>
        {weeks.flat().map((day, index) => {
          const dayLessons = lessonsOn(lessons, day);
          const weekend = index % 7 >= 5;
          const label = `${parseDate(day).getDate()}: ${dayLessons.length ? text.monthDay(dayLessons.length) : text.noLessons}`;
          return (
            <button
              key={day}
              type="button"
              className={cx(styles.monthCell, weekend && styles.monthWeekend, !isSameMonth(day, date) && styles.monthOut, day === today && styles.monthToday)}
              onClick={() => onPick(day)}
              aria-label={label}
            >
              <span className={styles.monthNumber}>{parseDate(day).getDate()}</span>
              <span className={styles.dots} aria-hidden="true">
                {dayLessons.slice(0, MAX_DOTS).map((lesson) => (
                  <i key={lesson.id} className={styles.dot} style={lessonColorStyle(getStudent(lesson.studentId))} />
                ))}
              </span>
              {dayLessons.length > 0 && <span className={styles.monthCount}>{text.monthDay(dayLessons.length)}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
