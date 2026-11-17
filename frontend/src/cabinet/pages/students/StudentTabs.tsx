import { cabinet } from "../../content/cabinet.ru";
import { getStudentDetails } from "../../data";
import type { AssignedTask, Student, Tone } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { formatSigned } from "../../model/format";
import { Pill } from "../../ui/Pill";
import { RowList } from "../../ui/RowList";
import { StudentEmpty, StudentSection } from "./StudentSection";

const text = cabinet.teacher.students.sheet;

const lessonTones: Record<Student["recentLessons"][number]["status"], Tone> = { done: "ok", cancelled: "bad", moved: "grey" };
const taskTones: Record<AssignedTask["status"], Tone> = { todo: "warn", wait: "blue", done: "ok" };

export function LessonsTab({ student }: { student: Student }) {
  return (
    <StudentSection title={text.tabs[1].label}>
      {student.recentLessons.length === 0 ? (
        <StudentEmpty text={text.lessons.empty} />
      ) : (
        <RowList>
          {student.recentLessons.map((lesson) => (
            <div key={lesson.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
              <span className="w-12 flex-none text-xs font-bold text-muted-foreground tabular-nums">{formatShortDate(lesson.date)}</span>
              <span className="min-w-28 flex-1 text-sm font-bold">{lesson.topic}</span>
              <Pill tone={lessonTones[lesson.status]}>{text.lessons.status[lesson.status]}</Pill>
            </div>
          ))}
        </RowList>
      )}
    </StudentSection>
  );
}

export function PaymentsTab({ student }: { student: Student }) {
  const { payments } = getStudentDetails(student.id);
  return (
    <StudentSection title={text.tabs[2].label}>
      {payments.length === 0 ? (
        <StudentEmpty text={text.payments.empty} />
      ) : (
        <RowList>
          {payments.map((move) => (
            <div key={`${move.date}-${move.title}-${move.amount}`} className="flex items-center gap-3 py-2.5">
              <span className="w-12 flex-none text-xs font-bold text-muted-foreground tabular-nums">{formatShortDate(move.date)}</span>
              <span className="min-w-0 flex-1 text-sm font-bold">{move.title}</span>
              <b className={`font-[family-name:var(--font-display)] text-sm font-extrabold whitespace-nowrap tabular-nums ${move.amount < 0 ? "text-destructive" : "text-success"}`}>
                {formatSigned(move.amount)}
              </b>
            </div>
          ))}
        </RowList>
      )}
    </StudentSection>
  );
}

export function TasksTab({ student }: { student: Student }) {
  const { tasks, trainer } = getStudentDetails(student.id);
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <StudentSection title={text.tasks.assigned}>
        {tasks.length === 0 ? (
          <StudentEmpty text={text.tasks.empty} />
        ) : (
          <RowList>
            {tasks.map((task) => (
              <div key={task.title} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5">
                <span className="min-w-28 flex-1 text-sm font-bold">{task.title}</span>
                {task.result && <span className="text-xs font-bold text-muted-foreground tabular-nums">{task.result}</span>}
                <Pill tone={taskTones[task.status]}>{text.tasks.status[task.status]}</Pill>
              </div>
            ))}
          </RowList>
        )}
      </StudentSection>
      <StudentSection title={text.tasks.trainer}>
        {trainer ? (
          <div className="grid gap-1 text-sm font-semibold tabular-nums">
            <span>{text.tasks.solved(trainer.solvedWeek)}</span>
            <span>{text.tasks.accuracy(trainer.accuracy)}</span>
            <span className="text-muted-foreground">{text.tasks.weak(trainer.weak)}</span>
          </div>
        ) : (
          <StudentEmpty text={text.tasks.noTrainer} />
        )}
      </StudentSection>
    </div>
  );
}

export function NotesTab({ student }: { student: Student }) {
  const { notes } = getStudentDetails(student.id);
  return (
    <StudentSection title={text.tabs[4].label}>
      {notes.length === 0 ? (
        <StudentEmpty text={text.notes.empty} />
      ) : (
        <RowList>
          {notes.map((note) => (
            <div key={`${note.date}-${note.text}`} className="flex gap-3 py-2.5">
              <span className="w-12 flex-none text-xs font-bold text-muted-foreground tabular-nums">{formatShortDate(note.date)}</span>
              <span className="min-w-0 flex-1 text-sm font-semibold">{note.text}</span>
            </div>
          ))}
        </RowList>
      )}
    </StudentSection>
  );
}
