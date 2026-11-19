import { AlertTriangle, CalendarX, ClipboardCheck, MessageCircle, Wallet } from "lucide-react";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails } from "../../../data";
import type { ScheduleLesson, Student } from "../../../mocks/types";
import { formatDayMonth } from "../../../model/dates";
import { formatRubles } from "../../../model/format";
import { studentAlerts, type StudentAlert } from "../../../model/studentAlerts";
import { homeworkTimeline, taskStats } from "../../../model/studentTasks";
import { cx } from "../../../ui/cx";
import { HomeworkPill, PastLessonRow, UpcomingRow, upcomingLessons } from "./LessonsTab";
import { MaterialRow } from "./MaterialsTab";
import { Empty, MoreButton, Panel } from "./parts";
import { ResultBars } from "./ResultBars";

const profile = cabinet.teacher.students.profile;
const text = profile.overview;
const RECENT = 3;
const POINTS = 8;
const MATERIALS = 2;
const MIN_BARS = 3;
/** Предупреждения, которые уже видны в шапке и сводке слева. */
const DUPLICATED: StudentAlert["kind"][] = ["debt", "packageLow", "telegram"];

export type ProfileTab = (typeof profile.tabs)[number]["id"];

function alertView(alert: StudentAlert): { label: string; icon: typeof Wallet; tone: string } {
  const a = profile.alerts;
  switch (alert.kind) {
    case "debt":
      return { label: a.debt(formatRubles(alert.amount)), icon: Wallet, tone: "bg-[var(--cab-bad-soft)] text-destructive" };
    case "packageLow":
      return { label: a.packageLow(alert.left), icon: Wallet, tone: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]" };
    case "overdue":
      return { label: a.overdue(alert.count), icon: AlertTriangle, tone: "bg-[var(--cab-bad-soft)] text-destructive" };
    case "review":
      return { label: a.review(alert.count), icon: ClipboardCheck, tone: "bg-accent text-accent-foreground" };
    case "telegram":
      return { label: a.telegram, icon: MessageCircle, tone: "bg-[var(--cab-warn-soft)] text-[var(--cab-warn)]" };
    case "noSchedule":
      return { label: a.noSchedule, icon: CalendarX, tone: "bg-secondary text-muted-foreground" };
  }
}

type Props = { student: Student; today: string; onOpenLesson: (lesson: ScheduleLesson) => void; onTab: (tab: ProfileTab) => void };

export function OverviewTab({ student, today, onOpenLesson, onTab }: Props) {
  const details = getStudentDetails(student.id);
  const alerts = studentAlerts(student, details, today).filter((alert) => !DUPLICATED.includes(alert.kind));
  const upcoming = upcomingLessons(student.id, RECENT);
  const recent = student.recentLessons.slice(0, RECENT);
  const points = homeworkTimeline(details.tasks).slice(-POINTS);
  const stats = taskStats(details.tasks);
  const note = details.notes[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {/* Только то, чего нет в шапке и сводке: долг, абонемент и Telegram видны там (STUDENTS-13). */}
      {alerts.length > 0 && (
      <section aria-label={profile.alerts.title} className="flex flex-wrap gap-2">
        {(
          alerts.map((alert) => {
            const view = alertView(alert);
            const Icon = view.icon;
            return (
              <span key={alert.kind} className={cx("inline-flex items-center gap-2 rounded-full px-3.5 py-2 text-base font-bold", view.tone)}>
                <Icon size={16} aria-hidden="true" />
                {view.label}
              </span>
            );
          })
        )}
      </section>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Panel title={text.upcoming} action={<MoreButton onClick={() => onTab("lessons")}>{text.details}</MoreButton>}>
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
        <Panel title={text.recent}>
          {recent.length === 0 ? (
            <Empty>{cabinet.teacher.students.sheet.lessons.empty}</Empty>
          ) : (
            <div className="grid divide-y divide-border">
              {recent.map((lesson) => (
                <PastLessonRow key={lesson.date} student={student} lesson={lesson} onOpenLesson={onOpenLesson}>
                  <HomeworkPill lesson={lesson} />
                </PastLessonRow>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Успеваемость и заметка — рядом: без графика успеваемость не занимает целую строку. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
        <Panel title={text.progress} action={<MoreButton onClick={() => onTab("tasks")}>{text.details}</MoreButton>}>
          {points.length === 0 ? (
            <Empty>{text.progressEmpty}</Empty>
          ) : (
            <div className={cx("grid items-end gap-6", points.length >= MIN_BARS && "sm:grid-cols-[auto_minmax(0,1fr)]")}>
              <div className="grid gap-1">
                <span className="text-base font-bold text-muted-foreground">{text.average}</span>
                <b className="font-[family-name:var(--font-display)] text-5xl leading-none font-black tabular-nums">{stats.percent}%</b>
                <span className="text-sm font-semibold text-muted-foreground">{text.checkedWorks(points.length)}</span>
              </div>
              {/* Один-два столбика ничего не показывают — график появляется с трёх проверенных работ. */}
              {points.length >= MIN_BARS && <ResultBars points={points} compact />}
            </div>
          )}
        </Panel>
        <Panel title={text.note} action={<MoreButton onClick={() => onTab("notes")}>{text.allNotes}</MoreButton>}>
          {note ? (
            <div className="grid gap-1">
              <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{formatDayMonth(note.date)}</span>
              <p className="m-0 text-lg font-semibold whitespace-pre-line">{note.text}</p>
            </div>
          ) : (
            <Empty>{cabinet.teacher.students.sheet.overview.noNote}</Empty>
          )}
        </Panel>
      </div>

      <Panel title={text.materials} action={<MoreButton onClick={() => onTab("materials")}>{text.allMaterials}</MoreButton>}>
          {details.materials.length === 0 ? (
            <Empty>{text.noMaterials}</Empty>
          ) : (
            <ul className="m-0 list-none divide-y divide-border p-0">
              {details.materials.slice(0, MATERIALS).map((material) => (
                <MaterialRow key={material.id} material={material} />
              ))}
            </ul>
          )}
        </Panel>
    </div>
  );
}
