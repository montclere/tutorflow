import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { addNote, getSchedule, getStudentDetails } from "../../data";
import type { RecentLesson, ScheduleLesson, Student, Tone } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { formatSigned } from "../../model/format";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Pill } from "../../ui/Pill";
import { RowList } from "../../ui/RowList";
import { StudentEmpty, StudentSection } from "./StudentSection";

const text = cabinet.teacher.students.sheet;

const lessonTones: Record<Student["recentLessons"][number]["status"], Tone> = { done: "ok", cancelled: "bad", moved: "grey" };

/** Урок из истории ученика в расписании — чтобы открыть его карточку (STUDENTS-5). */
export function scheduleLessonOf(studentId: string, date: string): ScheduleLesson | null {
  return getSchedule().lessons.find((lesson) => lesson.studentId === studentId && lesson.date === date) ?? null;
}

/** Строка истории: если урок есть в расписании, это кнопка, открывающая карточку урока. */
export function HistoryRow({
  student,
  lesson,
  onOpenLesson,
  children,
}: {
  student: Student;
  lesson: RecentLesson;
  onOpenLesson: (lesson: ScheduleLesson) => void;
  children: React.ReactNode;
}) {
  const scheduled = scheduleLessonOf(student.id, lesson.date);
  const content = (
    <>
      <span className="w-14 flex-none text-sm font-bold text-muted-foreground tabular-nums">{formatShortDate(lesson.date)}</span>
      <span className="min-w-28 flex-1 text-base font-bold">{lesson.topic}</span>
      {children}
    </>
  );
  if (!scheduled) return <div className="flex flex-wrap items-center gap-x-3 gap-y-1 py-3">{content}</div>;
  return (
    <button
      type="button"
      className="-mx-2 flex w-[calc(100%+1rem)] flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border-0 bg-transparent px-2 py-3 text-left text-inherit transition-colors [font:inherit] hover:bg-secondary"
      aria-label={text.openLesson(formatShortDate(lesson.date), lesson.topic)}
      onClick={() => onOpenLesson(scheduled)}
    >
      {content}
    </button>
  );
}

export function LessonsTab({ student, onOpenLesson }: { student: Student; onOpenLesson: (lesson: ScheduleLesson) => void }) {
  return (
    <StudentSection title={text.tabs[1].label}>
      {student.recentLessons.length === 0 ? (
        <StudentEmpty text={text.lessons.empty} />
      ) : (
        <RowList>
          {student.recentLessons.map((lesson) => (
            <HistoryRow key={lesson.date} student={student} lesson={lesson} onOpenLesson={onOpenLesson}>
              <Pill tone={lessonTones[lesson.status]}>{text.lessons.status[lesson.status]}</Pill>
            </HistoryRow>
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

function NoteForm({ student }: { student: Student }) {
  const { notify } = useNotifier();
  const [value, setValue] = useState("");

  const submit = () => {
    const note = value.trim();
    if (!note) return;
    addNote(student.id, { date: getSchedule().today, text: note });
    setValue("");
    notify(text.notes.added);
  };

  return (
    <form
      className="mb-2 grid gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <textarea
        value={value}
        rows={2}
        placeholder={text.notes.placeholder}
        aria-label={text.notes.label}
        className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base [font:inherit] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
        }}
      />
      <span className="flex justify-end">
        <Button type="submit" size="sm" variant="primary" disabled={value.trim() === ""}>
          {text.notes.add}
        </Button>
      </span>
    </form>
  );
}

export function NotesTab({ student }: { student: Student }) {
  const { notes } = getStudentDetails(student.id);
  return (
    <StudentSection title={text.tabs[4].label}>
      <NoteForm student={student} />
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
