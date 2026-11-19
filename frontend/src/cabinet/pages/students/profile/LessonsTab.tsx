import type { ReactNode } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { getSchedule } from "../../../data";
import type { RecentLesson, ScheduleLesson, Student, Tone } from "../../../mocks/types";
import { formatLongDay, formatShortDate } from "../../../model/dates";
import { compareLessons, isPast } from "../../../model/lessons";
import { Kpi, DateCell, Empty, Panel } from "./parts";
import { Pill } from "../../../ui/Pill";
import { lessonTime } from "../../schedule/LessonMeta";

const sheet = cabinet.teacher.students.sheet;
const text = cabinet.teacher.students.profile.lessons;
const GOOD_SHARE = 0.8;

const statusTones: Record<RecentLesson["status"], Tone> = { done: "ok", cancelled: "bad", moved: "grey" };

/** Будущие уроки ученика из расписания. */
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

const rowClass = "-mx-2 flex w-[calc(100%+1rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg px-2 py-3 text-left";

/** Строка прошедшего урока; если урок есть в расписании — открывает его карточку (STUDENTS-5). */
export function PastLessonRow({ student, lesson, onOpenLesson, children }: { student: Student; lesson: RecentLesson; onOpenLesson: (lesson: ScheduleLesson) => void; children: ReactNode }) {
  const scheduled = scheduleLessonOf(student.id, lesson.date);
  const content = (
    <>
      <DateCell>{formatShortDate(lesson.date)}</DateCell>
      <span className="min-w-28 flex-1 text-base font-bold">{lesson.topic}</span>
      {children}
    </>
  );
  if (!scheduled) return <div className={rowClass}>{content}</div>;
  return (
    <button
      type="button"
      className={`${rowClass} appearance-none border-0 bg-transparent text-inherit transition-colors [font-family:inherit] hover:bg-secondary`}
      aria-label={sheet.openLesson(formatShortDate(lesson.date), lesson.topic)}
      onClick={() => onOpenLesson(scheduled)}
    >
      {content}
    </button>
  );
}

export function UpcomingRow({ lesson, onOpenLesson }: { lesson: ScheduleLesson; onOpenLesson: (lesson: ScheduleLesson) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpenLesson(lesson)}
      className={`${rowClass} appearance-none border-0 bg-transparent text-inherit transition-colors [font-family:inherit] hover:bg-secondary`}
    >
      <span className="min-w-0 flex-1 text-base font-bold">{formatLongDay(lesson.date)}</span>
      <span className="text-sm font-bold text-muted-foreground tabular-nums">{lessonTime(lesson)}</span>
    </button>
  );
}

export function LessonsTab({ student, onOpenLesson }: { student: Student; onOpenLesson: (lesson: ScheduleLesson) => void }) {
  const upcoming = upcomingLessons(student.id);
  const past = student.recentLessons;
  const count = (status: RecentLesson["status"]) => past.filter((lesson) => lesson.status === status).length;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label={text.counts.done} value={String(student.lessonsCount)} />
        <Kpi label={text.counts.cancelled} value={String(count("cancelled"))} />
        <Kpi label={text.counts.moved} value={String(count("moved"))} />
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Panel title={text.upcoming}>
          {upcoming.length === 0 ? (
            <Empty>{text.noUpcoming}</Empty>
          ) : (
            <div className="grid divide-y divide-border">
              {upcoming.map((lesson) => (
                <UpcomingRow key={lesson.id} lesson={lesson} onOpenLesson={onOpenLesson} />
              ))}
            </div>
          )}
        </Panel>
        <Panel title={text.past}>
          {past.length === 0 ? (
            <Empty>{sheet.lessons.empty}</Empty>
          ) : (
            <div className="grid divide-y divide-border">
              {past.map((lesson) => (
                <PastLessonRow key={lesson.date} student={student} lesson={lesson} onOpenLesson={onOpenLesson}>
                  <HomeworkPill lesson={lesson} />
                  <Pill tone={statusTones[lesson.status]}>{sheet.lessons.status[lesson.status]}</Pill>
                </PastLessonRow>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
