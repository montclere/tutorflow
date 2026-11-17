import { cabinet } from "../../content/cabinet.ru";
import type { RecentLesson, Student, Tone } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { formatTimesPerWeek } from "../../model/format";
import { LinkButton } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { ProgressBar } from "../../ui/ProgressBar";
import { RowList } from "../../ui/RowList";
import { StudentEmpty, StudentSection } from "./StudentSection";

const text = cabinet.teacher.students.sheet.overview;
const RECENT_COUNT = 3;
const GOOD_SHARE = 0.8;

function Homework({ lesson }: { lesson: RecentLesson }) {
  const { homework } = lesson;
  if (!homework) return null;
  if (homework.done === null) return <Pill tone="bad">{text.homeworkMissing}</Pill>;
  const tone: Tone = homework.done / homework.total >= GOOD_SHARE ? "ok" : "warn";
  return <Pill tone={tone}>{text.homeworkDone(homework.done, homework.total)}</Pill>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-xs font-bold text-muted-foreground">{label}</dt>
      <dd className="m-0 text-sm font-semibold">{children}</dd>
    </div>
  );
}

export function StudentOverview({ student }: { student: Student }) {
  const { notifySoon } = useNotifier();
  const { schedule, exam, parent } = student;
  const scheduleLine =
    schedule.timesPerWeek === 0
      ? cabinet.teacher.students.noSchedule
      : text.scheduleLine(formatTimesPerWeek(schedule.timesPerWeek), schedule.days.join(", "), schedule.time, schedule.durationMin);
  const recent = student.recentLessons.slice(0, RECENT_COUNT);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
        <StudentSection title={text.schedule}>
          <p className="m-0 text-sm font-semibold tabular-nums">{scheduleLine}</p>
        </StudentSection>

        {exam && (
          <StudentSection title={text.exam}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-xs font-bold text-muted-foreground">{text.readiness}</span>
              <b className="font-[family-name:var(--font-display)] text-lg font-black tabular-nums">{exam.readiness}%</b>
            </div>
            <ProgressBar percent={exam.readiness} label={text.readiness} />
            <p className="m-0 text-sm font-semibold tabular-nums">{text.examDays(exam.daysLeft)}</p>
            <p className="m-0 text-sm font-semibold text-muted-foreground">{text.weak(exam.weak)}</p>
          </StudentSection>
        )}

        <StudentSection title={text.recent}>
          {recent.length === 0 ? (
            <StudentEmpty text={text.noLessons} />
          ) : (
            <RowList>
              {recent.map((lesson) => (
                <div key={lesson.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                  <span className="w-12 flex-none text-xs font-bold text-muted-foreground tabular-nums">{formatShortDate(lesson.date)}</span>
                  <span className="min-w-28 flex-1 text-sm font-bold">{lesson.topic}</span>
                  <Homework lesson={lesson} />
                </div>
              ))}
            </RowList>
          )}
        </StudentSection>
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] content-start gap-4">
        <StudentSection title={text.contacts}>
          <dl className="m-0 grid gap-3">
            <Fact label={text.telegram}>
              {student.telegramConnected ? <Pill tone="ok">{text.connected}</Pill> : <LinkButton onClick={() => notifySoon(text.telegram)}>{text.notConnected}</LinkButton>}
            </Fact>
            {parent && (
              <Fact label={text.parent}>
                {parent.relation}: {parent.name}
                <span className="block text-muted-foreground tabular-nums">{parent.phone}</span>
              </Fact>
            )}
            <Fact label={text.source}>{student.source}</Fact>
          </dl>
        </StudentSection>
        <StudentSection title={text.note}>
          <p className="m-0 text-sm font-semibold">{student.note || text.noNote}</p>
        </StudentSection>
      </div>
    </div>
  );
}

