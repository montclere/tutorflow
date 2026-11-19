import { Printer } from "lucide-react";
import { useState } from "react";
import { getStudents } from "../../data";
import { requestPrint, type PrintVariant } from "../../tasks/print";
import { tasksText } from "../../tasks/tasks.ru";
import type { TaskItem } from "../../tasks/types";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";

const text = tasksText.print;
const NONE = "none";

export type PrintSource = { title: string; items: TaskItem[]; due?: string; variants?: PrintVariant[] };

function Form({ source, onClose }: { source: PrintSource; onClose: () => void }) {
  const variants = source.variants ?? (["student", "answers", "blank"] as PrintVariant[]);
  const [variant, setVariant] = useState<PrintVariant>(variants[0] ?? "student");
  const [studentId, setStudentId] = useState(NONE);
  const students = getStudents().filter((student) => student.status === "active");

  const print = () => {
    const studentName = students.find((student) => student.id === studentId)?.name;
    onClose();
    // Окно закрывается, потом — печать: иначе диалог попал бы на лист.
    setTimeout(() => requestPrint({ title: source.title, items: source.items, variant, studentName, due: source.due }), 150);
  };

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.title}</DialogTitle>
        <DialogDescription>{text.description}</DialogDescription>
      </DialogHeader>
      <div className="grid gap-2" role="radiogroup" aria-label={text.variant}>
        {variants.map((id) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={variant === id}
            onClick={() => setVariant(id)}
            className={cx(
              "grid appearance-none gap-0.5 rounded-xl border-2 p-3 text-left text-foreground [font-family:inherit] transition-colors",
              variant === id ? "border-primary bg-accent" : "border-border bg-card hover:border-primary/50",
            )}
          >
            <b className="text-sm font-extrabold">{text.variants[id].label}</b>
            <span className="text-xs font-semibold text-muted-foreground">{text.variants[id].hint}</span>
          </button>
        ))}
      </div>
      {variant !== "answers" && (
        <label className="grid gap-1.5">
          <span className="text-xs font-bold text-muted-foreground">{text.student}</span>
          <Select value={studentId} onValueChange={setStudentId}>
            <SelectTrigger aria-label={text.student} className="w-full bg-card">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE}>{text.studentNone}</SelectItem>
              {students.map((student) => (
                <SelectItem key={student.id} value={student.id}>
                  {student.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </label>
      )}
      <DialogFooter className="gap-2">
        <Button onClick={onClose}>{text.cancel}</Button>
        <Button variant="primary" icon={Printer} onClick={print}>
          {text.print}
        </Button>
      </DialogFooter>
    </div>
  );
}

/** Выбор варианта листа перед печатью: для ученика, с ответами, бланк ответов (TASKS-9). */
export function PrintDialog({ source, onClose }: { source: PrintSource | null; onClose: () => void }) {
  return (
    <Dialog open={source !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">{source && <Form source={source} onClose={onClose} />}</DialogContent>
    </Dialog>
  );
}
