import { useState, type ReactNode } from "react";
import { editBody, studentsApi, studentsErrorCode, type TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { Button } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Input } from "@/shared/ui/kit/input";

const text = cabinet.teacher.live;
const fields = text.sheet.fields;

// Ограничения полей — как в схеме сервера (CardEdit).
const NAME_MAX = 80;
const SUBJECT_MAX = 80;
const GOAL_MAX = 500;
const NOTE_MAX = 4000;

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

type Props = { card: TeacherCard; onSaved: (card: TeacherCard) => void; onConflict: () => void };

/** Правка карточки с ожидаемой версией: чужая правка в другом окне не затирается молча. */
export function CardForm({ card, onSaved, onConflict }: Props) {
  const { notify } = useNotifier();
  const [draft, setDraft] = useState({ name: card.name, subject: card.subject ?? "", goal: card.goal ?? "", note: card.note ?? "" });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const nameError = tried && draft.name.trim() === "" ? text.sheet.nameRequired : undefined;
  const changed = editBody(card, draft) !== null;
  const update = (patch: Partial<typeof draft>) => setDraft((current) => ({ ...current, ...patch }));

  const save = async () => {
    setTried(true);
    if (draft.name.trim() === "" || !changed || busy) return;
    setBusy(true);
    try {
      onSaved(await studentsApi.edit(card, draft));
      notify(text.sheet.saved);
    } catch (error) {
      const code = studentsErrorCode(error);
      notify(text.errors[code]);
      if (code === "versionConflict") onConflict();
    } finally {
      setBusy(false);
    }
  };

  return (
    <form
      className="grid gap-4 rounded-2xl border bg-card p-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Field label={fields.name} error={nameError}>
        <Input value={draft.name} maxLength={NAME_MAX} aria-invalid={Boolean(nameError)} onChange={(event) => update({ name: event.target.value })} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={fields.subject} hint={fields.optional}>
          <Input value={draft.subject} maxLength={SUBJECT_MAX} placeholder={fields.subjectPlaceholder} onChange={(event) => update({ subject: event.target.value })} />
        </Field>
        <Field label={fields.goal} hint={fields.optional}>
          <Input value={draft.goal} maxLength={GOAL_MAX} placeholder={fields.goalPlaceholder} onChange={(event) => update({ goal: event.target.value })} />
        </Field>
      </div>
      <Field label={fields.note} hint={fields.noteHint}>
        <textarea
          value={draft.note}
          rows={3}
          maxLength={NOTE_MAX}
          className="w-full resize-y rounded-md border border-input bg-transparent px-3 py-2 text-base [font:inherit] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          onChange={(event) => update({ note: event.target.value })}
        />
      </Field>
      <span className="flex justify-end">
        <Button type="submit" variant="primary" disabled={!changed || busy}>
          {text.sheet.save}
        </Button>
      </span>
    </form>
  );
}
