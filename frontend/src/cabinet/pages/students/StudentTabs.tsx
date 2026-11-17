import { cabinet } from "../../content/cabinet.ru";
import { getStudentDetails } from "../../data";
import type { Student, Tone } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { formatSigned } from "../../model/format";
import { Pill } from "../../ui/Pill";
import { RowList } from "../../ui/RowList";
import { StudentEmpty, StudentSection } from "./StudentSection";

const text = cabinet.teacher.students.sheet;

const lessonTones: Record<Student["recentLessons"][number]["status"], Tone> = { done: "ok", cancelled: "bad", moved: "grey" };

export function LessonsTab({ student }: { student: Student }) {
  return (
    <StudentSection title={text.tabs[1].label}>
      {student.recentLessons.length === 0 ? (
        <StudentEmpty text={text.lessons.empty} />
      ) : (
        <RowList>
          {student.recentLessons.map((lesson) => (
            <div key={lesson.date} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">
              <span className="w-14 flex-none text-sm font-bold text-muted-foreground tabular-nums">{formatShortDate(lesson.date)}</span>
              <span className="min-w-28 flex-1 text-base font-bold">{lesson.topic}</span>
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
            <div key={`${move.date}-${move.title}-${move.amount}`} className="flex items-center gap-3 py-3">
              <span className="w-14 flex-none text-sm font-bold text-muted-foreground tabular-nums">{formatShortDate(move.date)}</span>
              <span className="min-w-0 flex-1 text-base font-bold">{move.title}</span>
              <b className={`font-[family-name:var(--font-display)] text-base font-extrabold whitespace-nowrap tabular-nums ${move.amount < 0 ? "text-destructive" : "text-success"}`}>
                {formatSigned(move.amount)}
              </b>
            </div>
          ))}
        </RowList>
      )}
    </StudentSection>
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
            <div key={`${note.date}-${note.text}`} className="flex gap-3 py-3">
              <span className="w-14 flex-none text-sm font-bold text-muted-foreground tabular-nums">{formatShortDate(note.date)}</span>
              <span className="min-w-0 flex-1 text-base font-semibold">{note.text}</span>
            </div>
          ))}
        </RowList>
      )}
    </StudentSection>
  );
}
