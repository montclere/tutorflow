import type { StudentNote } from "../mocks/types";

export type IdentifiedNote = StudentNote & { id: string };
export const NOTE_MAX = 2000;

export function normalizeNoteText(value: string): string | null {
  const text = value.trim();
  return text.length > 0 && text.length <= NOTE_MAX ? text : null;
}

/** ID старой записи зависит от неизменной позиции в источнике, а не редактируемого текста. */
export function projectNotes(studentId: string, stored: StudentNote[], added: IdentifiedNote[], edits: ReadonlyMap<string, string>, removed: ReadonlySet<string>): IdentifiedNote[] {
  return [...added, ...stored.map((note, index) => ({ ...note, id: `stored-${studentId}-${index}` }))]
    .filter((note) => !removed.has(note.id))
    .map((note) => ({ ...note, text: edits.get(note.id) ?? note.text }))
    .sort((a, b) => b.date.localeCompare(a.date));
}
