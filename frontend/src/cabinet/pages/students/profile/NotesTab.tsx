import { CalendarDays, NotebookPen, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { cabinet } from "../../../content/cabinet.ru";
import { addNote, getSchedule, getStudentDetails, removeNote, updateNote } from "../../../data";
import type { Student } from "../../../mocks/types";
import { formatDayMonth } from "../../../model/dates";
import { NOTE_MAX, normalizeNoteText, type IdentifiedNote } from "../../../model/studentNotes";
import { Button, IconButton } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { RecordDeleteDialog, useRecordDialogFocus } from "./RecordDialog";
import styles from "./profile-records.module.css";

const old = cabinet.teacher.students.sheet.notes;
const text = cabinet.teacher.students.profile.notes;
const actions = cabinet.teacher.students.profile.recordActions;

function NoteEditor({ note, onSave, onClose }: { note: IdentifiedNote | null; onSave: (value: string) => boolean; onClose: () => void }) {
  const [value, setValue] = useState(note?.text ?? "");
  const [error, setError] = useState(false);
  const focus = useRecordDialogFocus();
  const submit = () => { if (onSave(value)) onClose(); else setError(true); };
  return <Dialog open onOpenChange={(open) => !open && onClose()}>
    <DialogContent className="sm:max-w-lg" {...focus}>
      <form className={styles.noteForm} onSubmit={(event) => { event.preventDefault(); submit(); }}>
        <DialogHeader><DialogTitle>{note ? text.edit : text.add}</DialogTitle><DialogDescription>{text.private}</DialogDescription></DialogHeader>
        <textarea rows={5} maxLength={NOTE_MAX} aria-label={note ? text.edit : old.label} aria-invalid={error} aria-describedby={error ? "student-note-error" : undefined} placeholder={old.placeholder} value={value} onChange={(event) => { setValue(event.target.value); setError(false); }} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); submit(); } }} />
        {error && <p id="student-note-error" role="alert">{text.error}</p>}
        <DialogFooter><Button type="button" onClick={onClose}>{actions.cancel}</Button><Button type="submit" variant="primary" disabled={normalizeNoteText(value) === null}>{actions.save}</Button></DialogFooter>
      </form>
    </DialogContent>
  </Dialog>;
}

export function NotesTab({ student }: { student: Student }) {
  const { notify } = useNotifier();
  const { notes } = getStudentDetails(student.id);
  const [editor, setEditor] = useState<{ note: IdentifiedNote | null } | null>(null);
  const [removing, setRemoving] = useState<IdentifiedNote | null>(null);
  const add = () => setEditor({ note: null });
  return <section className={styles.panel} aria-labelledby="student-notes-title">
    <header className={styles.panelHeader}>
      <span className={`${styles.sectionIcon} ${styles.warm}`}><NotebookPen aria-hidden="true" /></span>
      <div className={styles.heading}><h3 id="student-notes-title">{text.title}</h3><p>{text.hint}</p></div>
      <Button variant="primary" icon={Plus} onClick={add}>{text.add}</Button>
    </header>
    {notes.length === 0 ? <div className={styles.empty}><NotebookPen aria-hidden="true" /><p>{text.empty}</p><Button icon={Plus} onClick={add}>{text.add}</Button></div> : <ol className={styles.notesList}>
      {notes.map((note) => <li key={note.id} className={styles.noteRow}>
        <time dateTime={note.date} className={styles.noteDate}><CalendarDays aria-hidden="true" />{formatDayMonth(note.date)}</time>
        <p className={styles.noteText}>{note.text}</p>
        <span className={styles.noteActions}><IconButton icon={Pencil} label={text.editLabel(formatDayMonth(note.date))} onClick={() => setEditor({ note })} /><IconButton icon={Trash2} label={text.deleteLabel(formatDayMonth(note.date))} onClick={() => setRemoving(note)} /></span>
      </li>)}
    </ol>}
    {editor && <NoteEditor note={editor.note} onClose={() => setEditor(null)} onSave={(value) => {
      const saved = editor.note ? updateNote(student.id, editor.note.id, value) : addNote(student.id, { date: getSchedule().today, text: value });
      if (saved) notify(editor.note ? text.saved : old.added);
      return saved;
    }} />}
    <RecordDeleteDialog open={removing !== null} title={text.deleteTitle} description={text.deleteDescription} onCancel={() => setRemoving(null)} onConfirm={() => { if (removing) { notify(removeNote(student.id, removing.id) ? text.removed : text.deleteError); setRemoving(null); } }} />
  </section>;
}
