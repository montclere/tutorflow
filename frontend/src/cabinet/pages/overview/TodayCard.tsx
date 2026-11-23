import { ArrowRight, Check } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudent } from "../../data";
import type { FreeWindowLink, LessonRow } from "../../mocks/types";
import { formatCountdown } from "../../model/format";
import { lessonMark, type LessonMark } from "../../model/overview";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { CabinetLink } from "../../ui/CabinetLink";
import { OverviewSection } from "./OverviewSection";
import { addDays, formatDayMonth } from "../../model/dates";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import styles from "./overview.module.css";
import { scheduleHref } from "../schedule/useScheduleUrl";

const text = cabinet.teacher.overview.today;
const MAX_FREE_WINDOWS = 3;

type LineProps = { lesson: LessonRow; mark: LessonMark; onOpen: (id: string) => void; onMark: (id: string) => void };

function LessonLine({ lesson, mark, onOpen, onMark }: LineProps) {
  const student = getStudent(lesson.studentId);
  return <li className={cx(styles.line, mark === "marked" && "opacity-60")}>
    <button type="button" className={styles.lessonButton} aria-label={text.openLesson(student.name, lesson.time)} onClick={() => onOpen(lesson.id)}>
      <span className={styles.lessonTime}>{lesson.time}</span>
      <Avatar initials={student.initials} color={student.color} />
      <span className={styles.person}><b>{student.name}</b><small>{lesson.goal}</small></span>
    </button>
    {mark === "toMark" && <Button size="sm" onClick={() => onMark(lesson.id)}>{text.mark}</Button>}
    {mark === "marked" && <Check size={16} className="flex-none text-muted-foreground" aria-label={text.doneLabel} />}
  </li>;
}

function NextLesson({ lesson, onOpen, onJoin }: { lesson: LessonRow; onOpen: (id: string) => void; onJoin: () => void }) {
  const student = getStudent(lesson.studentId);
  return <li className={styles.next}>
    <button type="button" className={styles.lessonButton} aria-label={text.openLesson(student.name, lesson.time)} onClick={() => onOpen(lesson.id)}>
      <span className={styles.lessonTime}>{lesson.time}</span>
      <Avatar initials={student.initials} color={student.color} />
      <span className={styles.person}><b>{student.name}</b><small>{lesson.goal}</small></span>
    </button>
    <div className={styles.nextActions}><span className={styles.countdown}>{formatCountdown(lesson.minutes)}</span><Button variant="lime" onClick={onJoin}>{text.join}<ArrowRight size={16} aria-hidden="true" /></Button></div>
  </li>;
}

function EmptyToday({ windows, today }: { windows: FreeWindowLink[]; today: string }) {
  return (
    <div className="py-4">
      <p className="m-0 text-base font-extrabold">{text.empty}</p>
      {windows.length > 0 && (
        <>
          <p className="m-0 mt-3 text-sm font-semibold text-muted-foreground">{text.freeTitle}</p>
          <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
            {windows.slice(0, MAX_FREE_WINDOWS).map((window) => (
              <li key={window.label}>
                <CabinetLink
                  href={scheduleHref("day", window.date, today)}
                  className="inline-flex rounded-full border border-border px-3 py-1.5 text-sm font-bold text-foreground no-underline tabular-nums transition-colors hover:bg-secondary"
                >
                  {window.label}
                </CabinetLink>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

type Props = {
  lessons: { today: LessonRow[]; tomorrow: LessonRow[] };
  freeWindows: FreeWindowLink[];
  today: string;
  onOpen: (id: string) => void;
};

export function TodayCard({ lessons, freeWindows, today, onOpen }: Props) {
  const { notify, notifySoon } = useNotifier();
  const [marked, setMarked] = useState<string[]>([]);
  const nextIndex = lessons.today.findIndex((lesson) => !lesson.past);

  const markDone = (id: string) => {
    setMarked((current) => [...current, id]);
    notify(cabinet.teacher.overview.attention.lessonDone);
  };

  const line = (lesson: LessonRow) => (
    <LessonLine key={lesson.id} lesson={lesson} mark={lessonMark(lesson, marked)} onOpen={onOpen} onMark={markDone} />
  );

  return (
    <OverviewSection title={text.title}>
      <h3 className={styles.day}>{cabinet.teacher.overview.mainDate(formatDayMonth(today))}</h3>
      {lessons.today.length === 0 ? (
        <EmptyToday windows={freeWindows} today={today} />
      ) : (
        <ul className={styles.timeline}>
          {lessons.today.map((lesson, index) =>
            index === nextIndex ? (
              <NextLesson key={lesson.id} lesson={lesson} onOpen={onOpen} onJoin={() => notifySoon(text.join)} />
            ) : (
              line(lesson)
            ),
          )}
        </ul>
      )}
      {lessons.tomorrow.length > 0 && (
        <>
          <h3 className={cx(styles.day, styles.tomorrow)}>{cabinet.teacher.overview.nextDate(formatDayMonth(addDays(today, 1)))}</h3>
          <ul className={styles.timeline}>{lessons.tomorrow.map(line)}</ul>
        </>
      )}
    </OverviewSection>
  );
}
