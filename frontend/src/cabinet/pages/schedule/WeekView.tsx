import { cabinet } from "../../content/cabinet.ru";
import type { ScheduleData, ScheduleLesson } from "../../mocks/types";
import { parseDate, weekDates, weekdayIndex } from "../../model/dates";
import { upcomingFreeWindows } from "../../model/freeSlots";
import { isPast, lessonsOn } from "../../model/lessons";
import { toMinutes } from "../../model/time";
import { assignColumns, blockPosition, gridHours, nowOffsetHours } from "../../model/scheduleLayout";
import { cx } from "../../ui/cx";
import { FreeSlot } from "./FreeSlot";
import { LessonBlock } from "./LessonBlock";
import type { ColorMode } from "./scheduleStyle";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;

type Props = {
  data: ScheduleData;
  lessons: ScheduleLesson[];
  date: string;
  withWeekend: boolean;
  colorMode: ColorMode;
  onOpen: (lesson: ScheduleLesson) => void;
};

export function WeekView({ data, lessons, date, withWeekend, colorMode, onOpen }: Props) {
  const { today, now, work } = data;
  const dates = weekDates(date, withWeekend);
  const hours = gridHours(work);
  const nowOffset = nowOffsetHours(now, work);
  const freeByDate = upcomingFreeWindows(data.lessons, dates, work, today, now);

  return (
    <div className={styles.scroller} role="group" aria-label={text.weekGridLabel}>
      <div className={styles.week} style={{ "--days": dates.length, "--hours": hours.length } as React.CSSProperties}>
        <div className={styles.corner} />
        {dates.map((day) => (
          <div key={day} className={cx(styles.dayHead, day === today && styles.todayHead)}>
            <span>{cabinet.weekdays[weekdayIndex(day)]}</span>
            <b className={cx(styles.dayNumber, day === today && styles.todayNumber)}>{parseDate(day).getDate()}</b>
          </div>
        ))}

        <div className={styles.times} aria-hidden="true">
          {hours.map((hour, index) => (
            <span key={hour} className={styles.timeLabel} style={{ top: `calc(var(--schedule-hour-height) * ${index})` }}>
              {hour}
            </span>
          ))}
        </div>

        {dates.map((day) => (
          <div key={day} className={cx(styles.dayColumn, day === today && styles.todayColumn)}>
            {freeByDate
              .filter((item) => item.date === day)
              .map(({ window }) => {
                const position = blockPosition(window.start, toMinutes(window.end) - toMinutes(window.start), work.start);
                return (
                  <FreeSlot
                    key={`${day}-${window.start}`}
                    label={text.freeLabel(cabinet.weekdays[weekdayIndex(day)] ?? "", window.start, window.end)}
                    style={{
                      top: `calc(var(--schedule-hour-height) * ${position.topHours} + 2px)`,
                      height: `calc(var(--schedule-hour-height) * ${position.heightHours} - 4px)`,
                    }}
                  />
                );
              })}
            {assignColumns(lessonsOn(lessons, day)).map(({ lesson, column, columns }) => {
              const position = blockPosition(lesson.start, lesson.durationMin, work.start);
              return (
                <LessonBlock
                  key={lesson.id}
                  lesson={lesson}
                  past={isPast(lesson, today, now)}
                  colorMode={colorMode}
                  onOpen={onOpen}
                  position={{
                    top: `calc(var(--schedule-hour-height) * ${position.topHours} + 1px)`,
                    height: `calc(var(--schedule-hour-height) * ${position.heightHours} - 2px)`,
                    left: `calc(${(100 / columns) * column}% + 2px)`,
                    width: `calc(${100 / columns}% - 4px)`,
                  }}
                />
              );
            })}
            {day === today && nowOffset !== null && (
              <div className={styles.now} style={{ top: `calc(var(--schedule-hour-height) * ${nowOffset})` }} role="img" aria-label={`${text.now} ${now}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
