import { useState } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { addNote, getSchedule, getStudentDetails } from "../../../data";
import type { Student } from "../../../mocks/types";
import { formatDayMonth } from "../../../model/dates";
import { Button } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Empty, Panel } from "./parts";

const old = cabinet.teacher.students.sheet.notes;
const text = cabinet.teacher.students.profile.notes;
const NOTE_MAX = 2000;

/** Заметки — лентой по датам; новая сверху, с сегодняшней датой. Ctrl/⌘+Enter — добавить. */
export function NotesTab({ student }: { student: Student }) {
  const { notify } = useNotifier();
  const { notes } = getStudentDetails(student.id);
  const [value, setValue] = useState("");

  const submit = () => {
    const note = value.trim();
    if (!note) return;
    addNote(student.id, { date: getSchedule().today, text: note });
    setValue("");
    notify(old.added);
  };

  return (
    <Panel title={text.title} hint={text.hint}>
      <form
        className="grid gap-2 rounded-xl bg-secondary/50 p-3"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <textarea
          value={value}
          rows={3}
          maxLength={NOTE_MAX}
          placeholder={old.placeholder}
          aria-label={old.label}
          className="w-full resize-y rounded-md border border-input bg-card px-3 py-2 text-base [font:inherit] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submit();
          }}
        />
        <span className="flex justify-end">
          <Button type="submit" size="sm" variant="primary" disabled={value.trim() === ""}>
            {old.add}
          </Button>
        </span>
      </form>
      {notes.length === 0 ? (
        <Empty>{old.empty}</Empty>
      ) : (
        <ol className="m-0 ml-1.5 grid list-none gap-0 border-l-2 border-border pl-5">
          {notes.map((note) => (
            <li key={`${note.date}-${note.text}`} className="relative grid gap-1 pb-5 last:pb-0">
              <span className="absolute top-1.5 -left-[27px] size-3 rounded-full border-2 border-card bg-primary" aria-hidden="true" />
              <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase tabular-nums">{formatDayMonth(note.date)}</span>
              <p className="m-0 text-base font-semibold whitespace-pre-line">{note.text}</p>
            </li>
          ))}
        </ol>
      )}
    </Panel>
  );
}
