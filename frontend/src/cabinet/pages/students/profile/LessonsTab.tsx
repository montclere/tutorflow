import { CalendarDays, CircleX, Repeat2, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { getSchedule } from "../../../data";
import type { RecentLesson, ScheduleLesson, Student, Tone } from "../../../mocks/types";
import { formatShortDate, parseDate } from "../../../model/dates";
import { compareLessons, isPast } from "../../../model/lessons";
import { Button } from "../../../ui/Button";
import { Pill } from "../../../ui/Pill";
import { lessonTime } from "../../schedule/LessonMeta";
import { NextLessonCard, PaymentSummary } from "./LessonSummary";
import styles from "./student-tabs.module.css";

const sheet = cabinet.teacher.students.sheet;
const text = cabinet.teacher.students.profile.lessons;
const GOOD_SHARE = 0.8;
const PAGE_SIZE = 5;
const statusTones: Record<RecentLesson["status"], Tone> = { done: "ok", cancelled: "grey", moved: "grey" };
const dateLabel = new Intl.DateTimeFormat("ru-RU", { weekday: "short", day: "numeric", month: "long" });

/** Существующая выборка расписания, также используется неизменённым обзором ученика. */
export function upcomingLessons(studentId: string, limit?: number): ScheduleLesson[] {
  const { lessons, today, now } = getSchedule();
  const upcoming = lessons.filter((lesson) => lesson.studentId === studentId && !isPast(lesson, today, now)).sort(compareLessons);
  return limit === undefined ? upcoming : upcoming.slice(0, limit);
}

function scheduleLessonOf(studentId: string, date: string): ScheduleLesson | null {
  return getSchedule().lessons.find((lesson) => lesson.studentId === studentId && lesson.date === date) ?? null;
}

export function HomeworkPill({ lesson }: { lesson: RecentLesson }) {
  const { homework } = lesson;
  if (!homework) return null;
  if (homework.done === null) return <Pill tone="bad">{text.homeworkMissing}</Pill>;
  return <Pill tone={homework.done / homework.total >= GOOD_SHARE ? "ok" : "warn"}>{text.homework(homework.done, homework.total)}</Pill>;
}

export function LessonStat({ icon: Icon, label, value, negative = false }: { icon: LucideIcon; label: string; value: number; negative?: boolean }) {
  return <div className={styles.lessonStat}><span className={`${styles.statIcon} ${negative ? styles.negativeIcon : ""}`}><Icon aria-hidden="true" /></span><div><span>{label}</span><b>{value}</b></div></div>;
}

export function PastLessonRow({ student, lesson, onOpenLesson, children }: { student: Student; lesson: RecentLesson; onOpenLesson: (lesson: ScheduleLesson) => void; children: ReactNode }) {
  const scheduled = scheduleLessonOf(student.id, lesson.date);
  const content = <><span className={styles.pastDate}>{formatShortDate(lesson.date)}</span><span className={styles.lessonTopic} title={lesson.topic}>{lesson.topic}</span><span className={styles.lessonStatuses}>{children}</span></>;
  if (!scheduled) return <div className={styles.pastRow}>{content}</div>;
  return <button type="button" className={styles.pastRow} aria-label={sheet.openLesson(formatShortDate(lesson.date), lesson.topic)} onClick={() => onOpenLesson(scheduled)}>{content}</button>;
}

export function UpcomingRow({ lesson, onOpenLesson }: { lesson: ScheduleLesson; onOpenLesson: (lesson: ScheduleLesson) => void }) {
  const day = dateLabel.format(parseDate(lesson.date));
  const label = day.charAt(0).toUpperCase() + day.slice(1);
  return <button type="button" className={styles.upcomingRow} onClick={() => onOpenLesson(lesson)}>
    <span className={styles.lessonIcon}><CalendarDays aria-hidden="true" /></span><span>{label}</span><span className={styles.lessonTime}>{lessonTime(lesson)}</span>
  </button>;
}

export function UpcomingLessonList({ lessons, onOpenLesson, onAdd }: { lessons: ScheduleLesson[]; onOpenLesson: (lesson: ScheduleLesson) => void; onAdd?: () => void }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  return <section className={`${styles.panel} ${styles.upcoming}`} aria-labelledby="student-upcoming-title"><h3 id="student-upcoming-title">{text.upcoming}</h3>
    {lessons.length === 0 ? <div className={styles.empty}><p>{text.noUpcoming}</p>{onAdd && <Button size="sm" onClick={onAdd}>{text.addLesson}</Button>}</div> : <ul className={styles.lessonList}>{lessons.slice(0, limit).map((lesson) => <li key={lesson.id}><UpcomingRow lesson={lesson} onOpenLesson={onOpenLesson} /></li>)}</ul>}
    {limit < lessons.length && <Button size="sm" aria-label={text.moreUpcoming} onClick={() => setLimit((value) => value + PAGE_SIZE)}>{text.more}</Button>}
  </section>;
}

export function PastLessonList({ student, onOpenLesson }: { student: Student; onOpenLesson: (lesson: ScheduleLesson) => void }) {
  const [limit, setLimit] = useState(PAGE_SIZE);
  const past = [...student.recentLessons].sort((a, b) => b.date.localeCompare(a.date));
  return <section className={`${styles.panel} ${styles.past}`}><h3>{text.past}</h3>
    {past.length === 0 ? <p className={styles.empty}>{sheet.lessons.empty}</p> : <ul className={styles.lessonList}>{past.slice(0, limit).map((lesson) => <li key={`${lesson.date}-${lesson.topic}`}><PastLessonRow student={student} lesson={lesson} onOpenLesson={onOpenLesson}><HomeworkPill lesson={lesson} /><Pill tone={statusTones[lesson.status]}>{sheet.lessons.status[lesson.status]}</Pill></PastLessonRow></li>)}</ul>}
    {limit < past.length && <Button size="sm" aria-label={text.morePast} onClick={() => setLimit((value) => value + PAGE_SIZE)}>{text.more}</Button>}
  </section>;
}

export function LessonsTab({ student, onOpenLesson, onAddLesson }: { student: Student; onOpenLesson: (lesson: ScheduleLesson) => void; onAddLesson?: () => void }) {
  const upcoming = upcomingLessons(student.id);
  const { today } = getSchedule();
  const count = (status: RecentLesson["status"]) => student.recentLessons.filter((lesson) => lesson.status === status).length;
  return <div className={styles.lessonsLayout}>
    <div className={styles.lessonMain}>
      <div className={styles.lessonStats}><LessonStat icon={CalendarDays} label={text.counts.done} value={student.lessonsCount} /><LessonStat icon={CircleX} label={text.counts.cancelled} value={count("cancelled")} negative /><LessonStat icon={Repeat2} label={text.counts.moved} value={count("moved")} /></div>
      <div className={styles.lessonColumns}><UpcomingLessonList lessons={upcoming} onOpenLesson={onOpenLesson} onAdd={onAddLesson} /><PastLessonList student={student} onOpenLesson={onOpenLesson} /></div>
    </div>
    <aside className={styles.lessonAside}><NextLessonCard student={student} today={today} next={upcoming[0]} onOpenLesson={onOpenLesson} /><PaymentSummary student={student} /></aside>
  </div>;
}
