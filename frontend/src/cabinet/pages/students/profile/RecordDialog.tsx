import { useRef } from "react";
import { Button } from "../../../ui/Button";
import { cabinet } from "../../../content/cabinet.ru";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";

/** У вложенного диалога нет отдельного DialogTrigger — возвращаем фокус на вызвавшую кнопку. */
export function useRecordDialogFocus() {
  const origin = useRef<HTMLElement | null>(null);
  return {
    onOpenAutoFocus: () => { origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; },
    onCloseAutoFocus: (event: Event) => { if (origin.current?.isConnected) { event.preventDefault(); origin.current.focus(); } },
  };
}

export function RecordDeleteDialog({ open, title, description, onCancel, onConfirm }: { open: boolean; title: string; description: string; onCancel: () => void; onConfirm: () => void }) {
  const focus = useRecordDialogFocus();
  const text = cabinet.teacher.students.profile.recordActions;
  return <Dialog open={open} onOpenChange={(value) => !value && onCancel()}>
    <DialogContent className="sm:max-w-md" {...focus}>
      <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription className="break-words">{description}</DialogDescription></DialogHeader>
      <DialogFooter><Button onClick={onCancel}>{text.cancel}</Button><Button className="bg-destructive text-white hover:bg-destructive/90" onClick={onConfirm}>{text.remove}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
