import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudents } from "../../data";
import { PaymentForm } from "../students/PaymentDialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

const text = cabinet.teacher.finance.record;

/** «+ Оплата» в финансах: сначала ученик, затем то же окно, что в карточке ученика (FINANCE-4). */
export function RecordPaymentDialog({ open, studentId, onClose }: { open: boolean; studentId?: string | null; onClose: () => void }) {
  const [picked, setPicked] = useState<string | null>(null);
  const students = getStudents().filter((student) => student.status !== "archive");
  const current = students.find((student) => student.id === (studentId ?? picked));
  const close = () => {
    setPicked(null);
    onClose();
  };
  return (
    <Dialog open={open} onOpenChange={(next) => !next && close()}>
      <DialogContent className="sm:max-w-md">
        {current ? (
          <PaymentForm key={current.id} student={current} onDone={close} />
        ) : (
          <div className="grid gap-4">
            <DialogHeader>
              <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.title}</DialogTitle>
              <DialogDescription>{text.choose}</DialogDescription>
            </DialogHeader>
            <Select onValueChange={setPicked}>
              <SelectTrigger aria-label={text.student} className="w-full bg-card">
                <SelectValue placeholder={text.choose} />
              </SelectTrigger>
              <SelectContent>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
