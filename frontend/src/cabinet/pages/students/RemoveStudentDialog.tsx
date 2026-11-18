import { cabinet } from "../../content/cabinet.ru";
import type { Student } from "../../mocks/types";
import { Button } from "../../ui/Button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";

const text = cabinet.teacher.students.sheet.remove;

type Props = { student: Student | null; onCancel: () => void; onConfirm: (student: Student) => void };

/** Удаление только после подтверждения (STUDENTS-4). */
export function RemoveStudentDialog({ student, onCancel, onConfirm }: Props) {
  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-md">
        {student && (
          <>
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.title}</DialogTitle>
              <DialogDescription>{text.text(student.name)}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button onClick={onCancel}>{text.cancel}</Button>
              <button
                type="button"
                className="inline-flex h-9 items-center justify-center rounded-md border-0 bg-destructive px-4 text-sm font-bold text-white transition-opacity hover:opacity-90"
                onClick={() => onConfirm(student)}
              >
                {text.confirm}
              </button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
