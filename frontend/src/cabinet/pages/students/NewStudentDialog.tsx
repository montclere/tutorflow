import { CalendarPlus, Copy, PartyPopper, Send } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { addStudent, getSchedule, getStudents } from "../../data";
import type { PaymentModel, StudentRecord } from "../../mocks/types";
import { buildStudentRecord, inviteText, newStudentErrors, type NewStudentError, type NewStudentInput } from "../../model/newStudent";
import { Button } from "../../ui/Button";
import { useNotifier } from "../../ui/Notifications";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/shared/ui/kit/dialog";
import { Input } from "@/shared/ui/kit/input";
import { ToggleGroup, ToggleGroupItem } from "@/shared/ui/kit/toggle-group";

const text = cabinet.teacher.students.add;
const DEFAULT_PRICE_RUB = 1500;
const DEFAULT_PACKAGE_LESSONS = 8;

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onFirstLesson: (studentId: string) => void;
  onOpenCard: (studentId: string) => void;
};

function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">
        {label}
        {hint && <span className="font-semibold"> · {hint}</span>}
      </span>
      {children}
      {error && <span className="text-sm font-semibold text-[var(--color-error)]">{error}</span>}
    </label>
  );
}

// Ссылка-заготовка: рабочую выдаст сервер (STUDENTS-6).
function inviteLink(id: string): string {
  return `${window.location.origin}/join/${id}`;
}

function AddForm({ onAdded, onCancel }: { onAdded: (record: StudentRecord) => void; onCancel: () => void }) {
  const [input, setInput] = useState<NewStudentInput>({
    name: "",
    goal: "",
    tariff: "per_lesson",
    priceRub: DEFAULT_PRICE_RUB,
    packageLessons: DEFAULT_PACKAGE_LESSONS,
    parent: "",
  });
  const [tried, setTried] = useState(false);
  const errors = newStudentErrors(input);
  const errorOf = (error: NewStudentError) => (tried && errors.includes(error) ? text.errors[error] : undefined);
  const update = (patch: Partial<NewStudentInput>) => setInput((current) => ({ ...current, ...patch }));

  const submit = () => {
    setTried(true);
    if (errors.length > 0) return;
    const record = buildStudentRecord(input, { id: `new-${Date.now()}`, today: getSchedule().today, colorIndex: getStudents().length });
    addStudent(record);
    onAdded(record);
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
        <DialogDescription>{text.description}</DialogDescription>
      </DialogHeader>

      <Field label={text.name} error={errorOf("name")}>
        <Input value={input.name} placeholder={text.namePlaceholder} aria-invalid={Boolean(errorOf("name"))} onChange={(event) => update({ name: event.target.value })} />
      </Field>
      <Field label={text.goal} hint={text.optional}>
        <Input value={input.goal} placeholder={text.goalPlaceholder} onChange={(event) => update({ goal: event.target.value })} />
      </Field>

      <div className="grid gap-1.5">
        <span className="text-xs font-bold text-muted-foreground">{text.tariff}</span>
        <ToggleGroup
          type="single"
          spacing={1}
          value={input.tariff}
          aria-label={text.tariff}
          className="w-full gap-1 rounded-lg border bg-card p-1"
          onValueChange={(value) => value && update({ tariff: value as PaymentModel })}
        >
          {text.tariffs.map((item) => (
            <ToggleGroupItem key={item.id} value={item.id} className="flex-1 data-[state=on]:bg-accent data-[state=on]:text-accent-foreground">
              {item.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={text.price} error={errorOf("price")}>
          <Input
            type="number"
            inputMode="numeric"
            min={0}
            step={50}
            value={input.priceRub || ""}
            aria-invalid={Boolean(errorOf("price"))}
            onChange={(event) => update({ priceRub: Number(event.target.value) })}
          />
        </Field>
        {input.tariff === "package" && (
          <Field label={text.lessons} error={errorOf("lessons")}>
            <Input
              type="number"
              inputMode="numeric"
              min={1}
              value={input.packageLessons || ""}
              aria-invalid={Boolean(errorOf("lessons"))}
              onChange={(event) => update({ packageLessons: Number(event.target.value) })}
            />
          </Field>
        )}
      </div>

      <Field label={text.parent} hint={text.optional}>
        <Input value={input.parent} placeholder={text.parentPlaceholder} onChange={(event) => update({ parent: event.target.value })} />
      </Field>

      <DialogFooter className="gap-2">
        <Button type="button" onClick={onCancel}>
          {text.cancel}
        </Button>
        <Button type="submit" variant="primary">
          {text.submit}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Invite({ record, onFirstLesson, onOpenCard }: { record: StudentRecord; onFirstLesson: () => void; onOpenCard: () => void }) {
  const { notify } = useNotifier();
  const link = inviteLink(record.id);
  const telegramHref = `https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(inviteText(record.name, "").trim())}`;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      notify(text.copied);
    } catch {
      // Буфер обмена может быть недоступен — ссылку всё равно видно в поле и её можно выделить.
    }
  };

  return (
    <div className="grid gap-5">
      <DialogHeader>
        <span className="grid size-12 place-items-center rounded-2xl bg-highlight text-highlight-foreground" aria-hidden="true">
          <PartyPopper size={24} />
        </span>
        <DialogTitle className="font-[family-name:var(--font-display)] text-xl font-black">{text.doneTitle(record.name)}</DialogTitle>
        <DialogDescription>{text.doneText}</DialogDescription>
      </DialogHeader>

      <div className="grid gap-1.5">
        <span className="text-xs font-bold text-muted-foreground">{text.linkLabel}</span>
        <div className="flex gap-2">
          <Input readOnly value={link} aria-label={text.linkLabel} onFocus={(event) => event.currentTarget.select()} className="font-semibold" />
          <Button icon={Copy} onClick={copy}>
            {text.copy}
          </Button>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <a
          href={telegramHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-[var(--color-blue)] px-4 text-sm font-bold text-white no-underline transition-opacity hover:opacity-90"
        >
          <Send size={16} aria-hidden="true" />
          {text.telegram}
        </a>
        <Button icon={CalendarPlus} onClick={onFirstLesson}>
          {text.firstLesson}
        </Button>
      </div>

      <DialogFooter>
        <Button onClick={onOpenCard}>{text.openCard}</Button>
      </DialogFooter>
    </div>
  );
}

/** Окно нового ученика: сначала форма, после добавления — ссылка-приглашение (STUDENTS-2). */
export function NewStudentDialog({ open, onOpenChange, onFirstLesson, onOpenCard }: Props) {
  const [added, setAdded] = useState<StudentRecord | null>(null);

  const change = (next: boolean) => {
    if (!next) setAdded(null);
    onOpenChange(next);
  };

  return (
    <Dialog open={open} onOpenChange={change}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        {added ? (
          <Invite
            record={added}
            onFirstLesson={() => {
              change(false);
              onFirstLesson(added.id);
            }}
            onOpenCard={() => {
              change(false);
              onOpenCard(added.id);
            }}
          />
        ) : (
          <AddForm onAdded={setAdded} onCancel={() => change(false)} />
        )}
      </DialogContent>
    </Dialog>
  );
}
