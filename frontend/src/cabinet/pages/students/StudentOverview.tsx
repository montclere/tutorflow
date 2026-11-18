import { cabinet } from "../../content/cabinet.ru";
import { CalendarPlus } from "lucide-react";
import type { RecentLesson, ScheduleLesson, Student, Tone } from "../../mocks/types";
import { formatTimesPerWeek } from "../../model/format";
import { Button, LinkButton } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { RowList } from "../../ui/RowList";
import { inviteLink } from "./NewStudentDialog";
import { StudentEmpty, StudentSection } from "./StudentSection";
import { HistoryRow } from "./StudentTabs";

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
    <div className="grid gap-1">
      <dt className="text-sm font-bold text-muted-foreground">{label}</dt>
      <dd className="m-0 text-base font-semibold">{children}</dd>
    </div>
  );
}

type Props = { student: Student; onOpenLesson: (lesson: ScheduleLesson) => void; onAssignSchedule: () => void };

export function StudentOverview({ student, onOpenLesson, onAssignSchedule }: Props) {
  const { notify } = useNotifier();

  const copyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink(student.id));
      notify(cabinet.teacher.students.sheet.inviteCopied);
    } catch {
      // Буфер обмена недоступен — ничего не делаем, ссылку можно взять в окне «Новый ученик».
    }
  };
  const { schedule, parent } = student;
  const scheduleLine =
    schedule.timesPerWeek === 0
      ? cabinet.teacher.students.noSchedule
      : text.scheduleLine(formatTimesPerWeek(schedule.timesPerWeek), schedule.days.join(", "), schedule.time, schedule.durationMin);
  const recent = student.recentLessons.slice(0, RECENT_COUNT);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <StudentSection title={text.schedule}>
        {schedule.timesPerWeek === 0 ? (
          // Вместо «Не задано» — сразу действие (STUDENTS-5).
          <Button icon={CalendarPlus} onClick={onAssignSchedule}>
            {cabinet.teacher.students.sheet.assignSchedule}
          </Button>
        ) : (
          <p className="m-0 text-base font-bold tabular-nums">{scheduleLine}</p>
        )}
      </StudentSection>

      <StudentSection title={text.recent}>
        {recent.length === 0 ? (
          <StudentEmpty text={text.noLessons} />
        ) : (
          <RowList>
            {recent.map((lesson) => (
              <HistoryRow key={lesson.date} student={student} lesson={lesson} onOpenLesson={onOpenLesson}>
                <Homework lesson={lesson} />
              </HistoryRow>
            ))}
          </RowList>
        )}
      </StudentSection>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 sm:grid-cols-2">
        <StudentSection title={text.contacts}>
          <dl className="m-0 grid gap-4">
            <Fact label={text.telegram}>
              {student.telegramConnected ? <Pill tone="ok">{text.connected}</Pill> : <LinkButton onClick={copyInvite}>{text.notConnected}</LinkButton>}
            </Fact>
            {parent && (
              <Fact label={text.parent}>
                {[parent.relation, parent.name].filter(Boolean).join(": ")}
                <span className="block text-muted-foreground tabular-nums">{parent.phone}</span>
              </Fact>
            )}
            <Fact label={text.source}>{student.source}</Fact>
          </dl>
        </StudentSection>
        <StudentSection title={text.note}>
          <p className="m-0 text-base font-semibold">{student.note || text.noNote}</p>
        </StudentSection>
      </div>
    </div>
  );
}
