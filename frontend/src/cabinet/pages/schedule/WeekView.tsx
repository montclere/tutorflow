import type { MouseEvent } from "react";
import { cabinet } from "../../content/cabinet.ru";
import type { ScheduleData, ScheduleLesson } from "../../mocks/types";
import { parseDate, weekDates, weekdayIndex } from "../../model/dates";
import { upcomingFreeWindows } from "../../model/freeSlots";
import { isPast, lessonsOn } from "../../model/lessons";
import { timeAtOffset, timeInWindow } from "../../model/newLesson";
import { toMinutes } from "../../model/time";
import { assignColumns, blockPosition, gridHours, nowOffsetHours } from "../../model/scheduleLayout";
import { cx } from "../../ui/cx";
import { FreeSlot } from "./FreeSlot";
import { LessonBlock } from "./LessonBlock";
import styles from "./schedule.module.css";

const text = cabinet.teacher.schedule;

type Props = {
  data: ScheduleData;
  lessons: ScheduleLesson[];
  date: string;
  onOpen: (lesson: ScheduleLesson) => void;
  onCreate: (date: string, start: string) => void;
};

export function WeekView({ data, lessons, date, onOpen, onCreate }: Props) {
  const { today, now, work } = data;
  const dates = weekDates(date);
  const hours = gridHours(work);
  const nowOffset = nowOffsetHours(now, work);
  const freeByDate = upcomingFreeWindows(data.lessons, dates, work, today, now);

  const createAt = (day: string, event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const hourHeight = rect.height / hours.length;
    const offset = event.clientY - rect.top;
    const hourIndex = Math.floor(offset / hourHeight);
    const start = timeAtOffset(work.start, hourIndex, (offset - hourIndex * hourHeight) / hourHeight);
    if (day === today && toMinutes(start) < toMinutes(now)) return;
    onCreate(day, start);
  };

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
            {day >= today && (
              // Мышью — клик по пустому месту; с клавиатуры то же делают свободные окна и «+ Урок» в шапке.
              // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
              <div className={styles.columnHit} onClick={(event) => createAt(day, event)} />
            )}
            {freeByDate
              .filter((item) => item.date === day)
              .map(({ window }) => {
                const position = blockPosition(window.start, toMinutes(window.end) - toMinutes(window.start), work.start);
                return (
                  <FreeSlot
                    key={`${day}-${window.start}`}
                    onCreate={(fraction) => onCreate(day, timeInWindow(window.start, window.end, fraction))}
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
