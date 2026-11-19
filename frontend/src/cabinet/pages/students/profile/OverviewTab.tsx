import { AlertTriangle, BookOpen, CalendarX, CheckCircle2, ClipboardCheck, MessageCircle, Presentation, Wallet } from "lucide-react";
import { cabinet } from "../../../content/cabinet.ru";
import { getStudentDetails } from "../../../data";
import type { ScheduleLesson, Student, StudentDetails } from "../../../mocks/types";
import { formatDayMonth } from "../../../model/dates";
import { formatRubles } from "../../../model/format";
import { studentAlerts, type StudentAlert } from "../../../model/studentAlerts";
import { homeworkTimeline, taskStats } from "../../../model/studentTasks";
import { cx } from "../../../ui/cx";
import { StatTile } from "../../../ui/StatTile";
import { HomeworkPill, PastLessonRow, UpcomingRow, upcomingLessons } from "./LessonsTab";
import { MaterialRow } from "./MaterialsTab";
import { Empty, MoreButton, Panel } from "./parts";
import { ResultBars } from "./ResultBars";

const profile = cabinet.teacher.students.profile;
const text = profile.overview;
const RECENT = 3;
const POINTS = 8;
const MATERIALS = 2;

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

/** Три плитки ученика: проведено, отмены и переносы, открытые материалы (VIBE-7). */
function StudentTiles({ student, details }: { student: Student; details: StudentDetails }) {
  const missed = student.recentLessons.filter((lesson) => lesson.status !== "done").length;
  const opened = details.materials.filter((material) => material.openedAt).length;
  const tiles = text.tiles;
  return (
    <div className="grid grid-cols-3 gap-3 max-[700px]:grid-cols-1">
        <StatTile tone="cyan" icon={Presentation} label={tiles.done} value={String(student.lessonsCount)} note={tiles.doneNote(student.lessonsCount)} />
        <StatTile tone="pink" icon={CalendarX} label={tiles.missed} value={String(missed)} note={tiles.missedNote(student.recentLessons.length)} />
        <StatTile tone="green" icon={BookOpen} label={tiles.materials} value={String(opened)} note={tiles.materialsNote(details.materials.length)} />
    </div>
  );
}

type Props = { student: Student; today: string; onOpenLesson: (lesson: ScheduleLesson) => void; onTab: (tab: ProfileTab) => void };

export function OverviewTab({ student, today, onOpenLesson, onTab }: Props) {
  const details = getStudentDetails(student.id);
  const alerts = studentAlerts(student, details, today);
  const upcoming = upcomingLessons(student.id, RECENT);
  const recent = student.recentLessons.slice(0, RECENT);
  const points = homeworkTimeline(details.tasks).slice(-POINTS);
  const stats = taskStats(details.tasks);
  const note = details.notes[0];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <section aria-label={profile.alerts.title} className="flex flex-wrap gap-2">
        {alerts.length === 0 ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--cab-ok-soft)] px-3 py-1.5 text-sm font-bold text-success">
            <CheckCircle2 size={16} aria-hidden="true" />
            {profile.alerts.none}
          </span>
        ) : (
          alerts.map((alert) => {
            const view = alertView(alert);
            const Icon = view.icon;
            return (
              <span key={alert.kind} className={cx("inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold", view.tone)}>
                <Icon size={16} aria-hidden="true" />
                {view.label}
              </span>
            );
          })
        )}
      </section>

      <StudentTiles student={student} details={details} />

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

      <Panel title={text.progress} action={<MoreButton onClick={() => onTab("tasks")}>{text.details}</MoreButton>}>
        {points.length === 0 ? (
          <Empty>{text.progressEmpty}</Empty>
        ) : (
          <div className="grid items-end gap-5 sm:grid-cols-[auto_minmax(0,1fr)]">
            <div className="grid gap-0.5">
              <span className="text-sm font-bold text-muted-foreground">{text.average}</span>
              <b className="font-[family-name:var(--font-display)] text-4xl leading-none font-black tabular-nums">{stats.percent}%</b>
            </div>
            <ResultBars points={points} compact />
          </div>
        )}
      </Panel>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-2">
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
        <Panel title={text.note} action={<MoreButton onClick={() => onTab("notes")}>{text.allNotes}</MoreButton>}>
          {note ? (
            <div className="grid gap-1">
              <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">{formatDayMonth(note.date)}</span>
              <p className="m-0 text-base font-semibold whitespace-pre-line">{note.text}</p>
            </div>
          ) : (
            <Empty>{cabinet.teacher.students.sheet.overview.noNote}</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}
