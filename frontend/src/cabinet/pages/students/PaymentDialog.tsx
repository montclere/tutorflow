import { useState, type ReactNode } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { addPayment, getSchedule } from "../../data";
import type { Student } from "../../mocks/types";
import { formatRubles } from "../../model/format";
import { paymentErrors, paymentMove, type PaymentError } from "../../model/newStudent";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.students.sheet.paymentForm;

function Field({ label, error, children }: { label: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      {children}
      {error && <span className="text-sm font-semibold text-[var(--color-error)]">{error}</span>}
    </label>
  );
}

function PaymentForm({ student, onDone }: { student: Student; onDone: () => void }) {
  const { notify } = useNotifier();
  const { today } = getSchedule();
  // По умолчанию — сумма долга, если он есть, иначе цена урока.
  const [amountRub, setAmountRub] = useState((student.balance < 0 ? -student.balance : student.payment.pricePerLesson) / 100);
  const [method, setMethod] = useState<string>(text.methods[2] ?? "");
  const [date, setDate] = useState(today);
  const [tried, setTried] = useState(false);
  const errors = paymentErrors({ amountRub, date }, today);
  const errorOf = (error: PaymentError) => (tried && errors.includes(error) ? text.errors[error] : undefined);

  const submit = () => {
    setTried(true);
    if (errors.length > 0) return;
    const move = paymentMove({ amountRub, date }, method);
    addPayment(student.id, move);
    notify(text.done(formatRubles(move.amount)));
    onDone();
  };

  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        submit();
      }}
    >
      <DialogHeader>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.title}</DialogTitle>
        <DialogDescription>{student.name}</DialogDescription>
      </DialogHeader>
      <Field label={text.amount} error={errorOf("amount")}>
        <Input type="number" inputMode="numeric" min={0} step={50} value={amountRub || ""} aria-invalid={Boolean(errorOf("amount"))} onChange={(event) => setAmountRub(Number(event.target.value))} />
      </Field>
      <div className="grid gap-1.5">
        <span className="text-xs font-bold text-muted-foreground">{text.method}</span>
        <ToggleGroup type="single" spacing={1} value={method} aria-label={text.method} className="w-full gap-1 rounded-lg border bg-card p-1" onValueChange={(value) => value && setMethod(value)}>
          {text.methods.map((item) => (
            <ToggleGroupItem key={item} value={item} className="flex-1 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              {item}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>
      <Field label={text.date} error={errorOf("future")}>
        <Input type="date" value={date} max={today} onChange={(event) => event.target.value && setDate(event.target.value)} />
      </Field>
      <DialogFooter className="gap-2">
        <Button type="button" onClick={onDone}>
          {text.cancel}
        </Button>
        <Button type="submit" variant="primary">
          {text.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Записать оплату: баланс пересчитывается сразу, оплата — первой в «Оплатах» (STUDENTS-3). */
export function PaymentDialog({ student, onClose }: { student: Student | null; onClose: () => void }) {
  return (
    <Dialog open={student !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">{student && <PaymentForm student={student} onDone={onClose} />}</DialogContent>
    </Dialog>
  );
}
