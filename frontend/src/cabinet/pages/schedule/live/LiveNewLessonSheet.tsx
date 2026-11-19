import { AlertTriangle, Check } from "lucide-react";
import { useState, type ReactNode } from "react";
import { lessonsApi, lessonsErrorCode, type LiveLesson, type SeriesOccurrence } from "../../../api/lessons";
import type { TeacherCard } from "../../../api/students";
import { cabinet } from "../../../content/cabinet.ru";
import { attemptKey, liveDraftErrors, MAX_SERIES_COUNT, MIN_SERIES_COUNT, TITLE_MAX, type LiveDraft, type LiveDraftError } from "../../../model/liveLesson";
import { MAX_DURATION_MIN, MIN_DURATION_MIN, TIME_STEP_MIN } from "../../../model/newLesson";
import { nowIn, zonedToUtc } from "../../../model/zoned";
import { Button } from "../../../ui/Button";
import { useNotifier } from "../../../ui/Notifications";
import { Input } from "@/shared/ui/kit/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/ui/kit/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/shared/ui/kit/sheet";

const text = cabinet.teacher.schedule.live.create;
const errorsText = cabinet.teacher.schedule.live.errors;
const DEFAULT_DURATION = 60;
const DEFAULT_COUNT = 8;
const DEFAULT_START = "16:00";

export type LiveLessonSeed = { date: string; start?: string; cardId?: string };

type Props = {
  seed: LiveLessonSeed | null;
  cards: TeacherCard[];
  timeZone: string;
  onClose: () => void;
  onCreated: (lessons: LiveLesson[]) => void;
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

function Form({ seed, cards, timeZone, onClose, onCreated }: Props & { seed: LiveLessonSeed }) {
  const { notify } = useNotifier();
  // Урок можно поставить только ученику, который принял приглашение (lesson_student_not_linked).
  const linked = cards.filter((card) => card.status === "active" && card.hasStudentAccount);
  const { today, now } = nowIn(timeZone);
  const [draft, setDraft] = useState<LiveDraft>({
    cardId: linked.some((card) => card.id === seed.cardId) ? (seed.cardId ?? null) : linked.length === 1 ? (linked[0]?.id ?? null) : null,
    title: "",
    // Из прошлого дня в календаре урок ставится на сегодня.
    date: seed.date < today ? today : seed.date,
    start: seed.start ?? DEFAULT_START,
    durationMin: DEFAULT_DURATION,
    repeat: false,
    count: DEFAULT_COUNT,
  });
  const [tried, setTried] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [plan, setPlan] = useState<SeriesOccurrence[] | null>(null);
  const [attempt, setAttempt] = useState<{ key: string; payload: string } | null>(null);

  const errors = liveDraftErrors(draft, today, now);
  const errorOf = (error: LiveDraftError) => (tried && errors.includes(error) ? text.errors[error] : undefined);
  const update = (patch: Partial<LiveDraft>) => {
    setDraft((current) => ({ ...current, ...patch }));
    setPlan(null);
    setFailure(null);
  };

  const seriesInput = () => ({
    cardId: draft.cardId ?? "",
    firstLocalStart: `${draft.date}T${draft.start}`,
    timezone: timeZone,
    count: draft.count,
    durationMinutes: draft.durationMin,
  });

  const check = async () => {
    setTried(true);
    if (errors.length > 0 || busy) return;
    setBusy(true);
    try {
      setPlan(await lessonsApi.previewSeries(seriesInput()));
    } catch (error) {
      setFailure(errorsText[lessonsErrorCode(error)]);
    } finally {
      setBusy(false);
    }
  };

  const submit = async () => {
    setTried(true);
    if (errors.length > 0 || busy) return;
    const payload = JSON.stringify({ ...draft, title: draft.title.trim(), timeZone });
    const next = attemptKey(attempt, payload, () => crypto.randomUUID());
    setAttempt(next);
    setBusy(true);
    setFailure(null);
    try {
      const single = {
        cardId: draft.cardId ?? "",
        startsAt: zonedToUtc(draft.date, draft.start, timeZone),
        durationMinutes: draft.durationMin,
        title: draft.title.trim(),
        clientRequestId: next.key,
      };
      const created = draft.recorded
        ? [await lessonsApi.recordCompleted(single)]
        : draft.repeat
        ? await lessonsApi.createSeries({ ...seriesInput(), title: draft.title.trim(), clientRequestId: next.key })
        : [
            await lessonsApi.create({
              cardId: draft.cardId ?? "",
              startsAt: zonedToUtc(draft.date, draft.start, timeZone),
              durationMinutes: draft.durationMin,
              title: draft.title.trim(),
              clientRequestId: next.key,
            }),
          ];
      notify(draft.recorded ? text.createdRecorded : draft.repeat ? text.createdSeries(created.length) : text.created);
      onCreated(created);
    } catch (error) {
      setFailure(errorsText[lessonsErrorCode(error)]);
    } finally {
      setBusy(false);
    }
  };

  const conflicts = plan?.filter((item) => item.conflicts).length ?? 0;

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <SheetHeader className="pr-12">
        <SheetTitle className="m-0 font-[family-name:var(--font-display)] text-xl font-black">{text.title}</SheetTitle>
        <SheetDescription className="m-0">{text.description}</SheetDescription>
      </SheetHeader>

      <div className="grid gap-4 overflow-y-auto p-4">
        {linked.length === 0 ? (
          <p className="m-0 rounded-xl border border-dashed p-4 text-sm font-semibold text-muted-foreground">{text.noStudents}</p>
        ) : (
          <Field label={text.student} error={errorOf("student")}>
            <Select value={draft.cardId ?? ""} onValueChange={(cardId) => update({ cardId })}>
              <SelectTrigger aria-label={text.student} aria-invalid={Boolean(errorOf("student"))} className="w-full">
                <SelectValue placeholder={text.chooseStudent} />
              </SelectTrigger>
              <SelectContent>
                {linked.map((card) => (
                  <SelectItem key={card.id} value={card.id}>
                    {card.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        )}
        {linked.length < cards.filter((card) => card.status === "active").length && <p className="m-0 text-sm font-semibold text-muted-foreground">{text.notLinkedHint}</p>}

        <Field label={text.topic} error={errorOf("topic")}>
          <Input value={draft.title} maxLength={TITLE_MAX} placeholder={text.topicPlaceholder} aria-invalid={Boolean(errorOf("topic"))} onChange={(event) => update({ title: event.target.value })} />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={text.date} error={errorOf("past") ?? errorOf("future")}>
            <Input
              type="date"
              value={draft.date}
              min={draft.recorded ? undefined : today}
              max={draft.recorded ? today : undefined}
              aria-invalid={Boolean(errorOf("past") ?? errorOf("future"))}
              onChange={(event) => update({ date: event.target.value })}
            />
          </Field>
          <Field label={text.time}>
            <Input type="time" step={TIME_STEP_MIN * 60} value={draft.start} onChange={(event) => update({ start: event.target.value })} />
          </Field>
        </div>

        <Field label={text.duration} error={errorOf("duration")}>
          <Input
            type="number"
            inputMode="numeric"
            min={MIN_DURATION_MIN}
            max={MAX_DURATION_MIN}
            step={TIME_STEP_MIN}
            value={draft.durationMin || ""}
            aria-invalid={Boolean(errorOf("duration"))}
            onChange={(event) => update({ durationMin: Number(event.target.value) })}
          />
        </Field>

        <label className="grid gap-1 text-sm font-bold">
          <span className="flex items-center gap-2.5">
            <input type="checkbox" className="size-4 accent-[var(--color-blue)]" checked={draft.recorded ?? false} onChange={(event) => update({ recorded: event.target.checked, repeat: event.target.checked ? false : draft.repeat })} />
            {text.recorded}
          </span>
          {draft.recorded && <span className="pl-6.5 text-xs font-semibold text-muted-foreground">{text.recordedHint}</span>}
        </label>

        {!draft.recorded && (
          <label className="flex items-center gap-2.5 text-sm font-bold">
            <input type="checkbox" className="size-4 accent-[var(--color-blue)]" checked={draft.repeat} onChange={(event) => update({ repeat: event.target.checked })} />
            {text.repeat}
          </label>
        )}

        {draft.repeat && !draft.recorded && (
          <div className="grid gap-3 rounded-xl border bg-secondary/40 p-3">
            <Field label={text.count} hint={text.countHint(MAX_SERIES_COUNT)} error={errorOf("count")}>
              <Input
                type="number"
                inputMode="numeric"
                min={MIN_SERIES_COUNT}
                max={MAX_SERIES_COUNT}
                value={draft.count || ""}
                aria-invalid={Boolean(errorOf("count"))}
                onChange={(event) => update({ count: Number(event.target.value) })}
              />
            </Field>
            <span>
              <Button type="button" size="sm" disabled={busy} onClick={() => void check()}>
                {text.check}
              </Button>
            </span>
            {plan && (
              <p className={`m-0 flex items-center gap-2 text-sm font-semibold ${conflicts > 0 ? "text-destructive" : "text-success"}`} role="status">
                {conflicts > 0 ? <AlertTriangle size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
                {conflicts > 0 ? text.conflicts(conflicts, plan.length) : text.free(plan.length)}
              </p>
            )}
          </div>
        )}

        {failure && (
          <p className="m-0 text-sm font-semibold text-destructive" role="alert">
            {failure}
          </p>
        )}
      </div>

      <SheetFooter className="mt-auto grid grid-cols-2 gap-2">
        <Button type="button" onClick={onClose}>
          {text.cancel}
        </Button>
        <Button type="submit" variant="primary" disabled={busy || linked.length === 0}>
          {draft.recorded ? text.submitRecorded : draft.repeat ? text.submitSeries(draft.count) : text.submit}
        </Button>
      </SheetFooter>
    </form>
  );
}

/** Новый урок рабочей сборки: разовый или серия раз в неделю (docs/api/lessons.md). */
export function LiveNewLessonSheet(props: Props) {
  const { seed, onClose } = props;
  return (
    <Sheet open={seed !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="gap-0">{seed && <Form key={`${seed.date}-${seed.start ?? ""}-${seed.cardId ?? ""}`} {...props} seed={seed} />}</SheetContent>
    </Sheet>
  );
}
