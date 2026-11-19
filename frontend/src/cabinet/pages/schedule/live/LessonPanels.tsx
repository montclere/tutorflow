import { useCallback, useEffect, useState, type ReactNode } from "react";
import { lessonRequestsApi, type AbsenceNotice, type CabinetRole, type RescheduleRequest } from "../../../api/lessonRequests";
import { lessonsApi, lessonsErrorCode, type LessonChange, type LessonContent, type LiveLesson, type LiveSeries, type ReschedulePlan } from "../../../api/lessons";
import { cabinet } from "../../../content/cabinet.ru";
import { lessonsText } from "../../../content/lessons.ru";
import { formatLongDay } from "../../../model/dates";
import { zonedParts, zonedToUtc } from "../../../model/zoned";
import { Button } from "../../../ui/Button";
import { cx } from "../../../ui/cx";
import { useNotifier } from "../../../ui/Notifications";

const text = lessonsText;
const errors = cabinet.teacher.schedule.live.errors;

export const fieldClass =
  "w-full rounded-md border border-input bg-card px-3 py-2 text-base [font-family:inherit] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50";

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="grid gap-1.5">
      <span className="text-xs font-bold text-muted-foreground">
        {label}
        {hint && <span className="font-semibold"> · {hint}</span>}
      </span>
      {children}
    </label>
  );
}

/** Момент API на часах зоны: «Понедельник, 23 ноября · 17:00». */
export function whenLabel(iso: string, timeZone: string): string {
  const { date, time } = zonedParts(iso, timeZone);
  return `${formatLongDay(date)} · ${time}`;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 px-4 pt-5">
      <h3 className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  );
}

/** Предложения переноса: кто предложил, даты «было → станет», причина; решить или отозвать — по флагам сервера. */
export function RequestsList({ cabinet: role, items, timeZone, onDone }: { cabinet: CabinetRole; items: RescheduleRequest[]; timeZone: string; onDone: () => void }) {
  const { notify } = useNotifier();
  const [busy, setBusy] = useState(false);
  if (items.length === 0) return null;
  const run = async (operation: () => Promise<RescheduleRequest>) => {
    if (busy) return;
    setBusy(true);
    try {
      const result = await operation();
      notify(text.requests.done[result.status] ?? text.requestStatus[result.status]);
      onDone();
    } catch (error) {
      notify(errors[lessonsErrorCode(error)]);
      onDone();
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title={text.requests.title}>
      <ul className="m-0 grid list-none gap-2 p-0">
        {items.map((item) => (
          <li key={item.id} className="grid gap-1.5 rounded-xl border bg-card p-3">
            <b className="text-sm font-extrabold">
              {text.roles[item.requesterRole]} · {text.requestStatus[item.status]}
            </b>
            {item.occurrences.map((occurrence) => (
              <span key={occurrence.lessonId} className="text-sm font-semibold tabular-nums">
                {whenLabel(occurrence.startsAt, timeZone)} → {whenLabel(occurrence.proposedStartsAt, timeZone)}
              </span>
            ))}
            {item.reason && <span className="text-sm text-muted-foreground">{item.reason}</span>}
            {(item.canResolve || item.canWithdraw) && (
              <div className="flex flex-wrap gap-2 pt-1">
                {item.canResolve && (
                  <>
                    <Button variant="lime" disabled={busy} onClick={() => void run(() => lessonRequestsApi.resolve(role, item, "accept"))}>
                      {text.requests.accept}
                    </Button>
                    <Button disabled={busy} onClick={() => void run(() => lessonRequestsApi.resolve(role, item, "decline"))}>
                      {text.requests.decline}
                    </Button>
                  </>
                )}
                {item.canWithdraw && (
                  <Button disabled={busy} onClick={() => void run(() => lessonRequestsApi.withdraw(role, item))}>
                    {text.requests.withdraw}
                  </Button>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function NoticesList({ cabinet: role, items, onDone }: { cabinet: CabinetRole; items: AbsenceNotice[]; onDone: () => void }) {
  const { notify } = useNotifier();
  if (items.length === 0) return null;
  const withdraw = async (notice: AbsenceNotice) => {
    try {
      await lessonRequestsApi.withdrawNotice(role, notice);
      notify(text.notices.withdrawn);
    } catch (error) {
      notify(errors[lessonsErrorCode(error)]);
    }
    onDone();
  };
  return (
    <Section title={text.notices.title}>
      <ul className="m-0 grid list-none gap-2 p-0">
        {items.map((notice) => (
          <li key={notice.id} className="grid gap-1 rounded-xl border bg-[var(--cab-warn-soft)] p-3">
            <b className="text-sm font-extrabold">
              {text.roles[notice.requesterRole]} · {text.noticeStatus[notice.status]}
            </b>
            {notice.reason && <span className="text-sm">{notice.reason}</span>}
            {notice.canWithdraw && (
              <div className="pt-1">
                <Button onClick={() => void withdraw(notice)}>{text.notices.withdraw}</Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function HistoryList({ items, timeZone }: { items: { event: string; occurredAt: string; detail?: string | null; who?: string | null }[]; timeZone: string }) {
  return (
    <Section title={text.history.title}>
      {items.length === 0 ? (
        <p className="m-0 text-sm font-semibold text-muted-foreground">{text.history.empty}</p>
      ) : (
        <ol className="m-0 grid list-none gap-0 border-l-2 border-border py-0 pr-0 pl-4">
          {items.map((item, index) => (
            <li key={`${item.event}-${item.occurredAt}-${index}`} className="relative grid gap-0.5 pb-3 before:absolute before:top-1.5 before:-left-[21px] before:size-2 before:rounded-full before:bg-primary">
              <b className="text-sm font-extrabold">{text.events[item.event] ?? item.event}</b>
              {item.detail && <span className="text-sm">{item.detail}</span>}
              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                {whenLabel(item.occurredAt, timeZone)}
                {item.who ? ` · ${item.who}` : ""}
              </span>
            </li>
          ))}
        </ol>
      )}
    </Section>
  );
}

function changeDetail(change: LessonChange, timeZone: string): string | null {
  if (change.event === "lesson_rescheduled" && change.before?.starts_at && change.after?.starts_at) return `${whenLabel(change.before.starts_at, timeZone)} → ${whenLabel(change.after.starts_at, timeZone)}`;
  if (change.changedFields.length > 0) return change.changedFields.map((field) => text.fields[field] ?? field).join(", ");
  return change.reason;
}

type Panel = "move" | "edit" | "series" | "delete" | null;

type Props = {
  lesson: LiveLesson;
  timeZone: string;
  /** Урок изменился — обновить его в календаре. */
  onChanged: (lesson: LiveLesson) => void;
  /** Изменилось больше одного урока или урок удалён — перезагрузить окно календаря. */
  onReload: () => void;
  onClose: () => void;
  upcoming: boolean;
};

/**
 * Действия и ленты урока в рабочей сборке — по логике интерфейса бэкенда (SCHEDULE-11…16): перенос — предложением
 * ученику, правка содержания урока или шаблона серии, отмена будущих дат серии, удаление; ниже — предложения
 * переноса, предупреждения о неявке и история урока.
 */
export function LessonPanels({ lesson, timeZone, onChanged, onReload, onClose, upcoming }: Props) {
  const { notify } = useNotifier();
  const [panel, setPanel] = useState<Panel>(null);
  const [series, setSeries] = useState<LiveSeries | null>(null);
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [notices, setNotices] = useState<AbsenceNotice[]>([]);
  const [history, setHistory] = useState<LessonChange[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  // «Сейчас» фиксируется при открытии карточки: от него зависят «будущие даты серии».
  const [now] = useState(() => Date.now());
  const load = useCallback(() => setReloadKey((key) => key + 1), []);

  useEffect(() => {
    let alive = true;
    void Promise.all([
      lessonRequestsApi.requests("teacher", lesson.id).catch(() => []),
      lessonRequestsApi.notices("teacher", lesson.id).catch(() => []),
      lessonsApi.history(lesson.id).catch(() => []),
      lesson.seriesId ? lessonsApi.series(lesson.seriesId).catch(() => null) : Promise.resolve(null),
    ]).then(([nextRequests, nextNotices, nextHistory, nextSeries]) => {
      if (!alive) return;
      setRequests(nextRequests);
      setNotices(nextNotices);
      setHistory(nextHistory);
      setSeries(nextSeries);
    });
    return () => {
      alive = false;
    };
  }, [lesson.id, lesson.seriesId, lesson.version, reloadKey]);

  const fail = (error: unknown) => {
    const code = lessonsErrorCode(error);
    notify(errors[code]);
    if (code === "versionConflict" || code === "stateConflict" || code === "precondition") onReload();
  };

  const futureSeries = series?.lessons.filter((item) => item.status === "scheduled" && Date.parse(item.startsAt) > now) ?? [];
  const actions: { id: Exclude<Panel, null>; label: string; show: boolean }[] = [
    { id: "move", label: text.move.open, show: upcoming && lesson.status === "scheduled" },
    { id: "edit", label: text.edit.open, show: true },
    { id: "series", label: text.seriesCancel.open, show: futureSeries.length > 0 },
    { id: "delete", label: text.remove.open, show: true },
  ];

  return (
    <>
      <div className="flex flex-wrap gap-1.5 px-4 pt-4" role="group" aria-label={cabinet.teacher.schedule.live.sheet.status}>
        {actions
          .filter((action) => action.show)
          .map((action) => (
            <button
              key={action.id}
              type="button"
              aria-expanded={panel === action.id}
              onClick={() => setPanel(panel === action.id ? null : action.id)}
              className={cx(
                "h-8 rounded-full border px-3 text-sm font-bold [font-family:inherit] transition-colors",
                panel === action.id ? "border-primary bg-accent text-accent-foreground" : "border-border bg-card text-foreground hover:bg-secondary",
                action.id === "delete" && panel !== action.id && "text-destructive",
              )}
            >
              {action.label}
            </button>
          ))}
      </div>

      {panel === "move" && (
        <MovePanel
          key={lesson.version}
          lesson={lesson}
          series={series}
          timeZone={timeZone}
          onSent={() => {
            notify(text.move.sent);
            setPanel(null);
            void load();
          }}
          onError={fail}
        />
      )}
      {panel === "edit" && (
        <EditPanel
          key={lesson.version}
          lesson={lesson}
          series={series}
          now={now}
          onSaved={(changed, many) => {
            notify(text.edit.saved);
            setPanel(null);
            onChanged(changed);
            if (many) onReload();
          }}
          onError={fail}
        />
      )}
      {panel === "series" && series && (
        <SeriesCancelPanel
          lesson={lesson}
          series={series}
          future={futureSeries}
          now={now}
          timeZone={timeZone}
          onDone={() => {
            notify(text.seriesCancel.done);
            setPanel(null);
            onReload();
            void lessonsApi.get(lesson.id).then(onChanged, () => undefined);
          }}
          onError={fail}
        />
      )}
      {panel === "delete" && (
        <div className="grid gap-3 px-4 pt-4">
          <p className="m-0 text-sm font-semibold text-muted-foreground">{text.remove.warn}</p>
          <Button
            variant="primary"
            className="bg-destructive hover:bg-destructive/90"
            onClick={() =>
              void lessonsApi.remove(lesson).then(
                () => {
                  notify(text.remove.done);
                  onReload();
                  onClose();
                },
                fail,
              )
            }
          >
            {text.remove.confirm}
          </Button>
        </div>
      )}

      <RequestsList cabinet="teacher" items={requests} timeZone={timeZone} onDone={() => {
        void load();
        onReload();
      }} />
      <NoticesList cabinet="teacher" items={notices} onDone={() => void load()} />
      <HistoryList items={history.map((item) => ({ event: item.event, occurredAt: item.occurredAt, detail: changeDetail(item, timeZone) }))} timeZone={timeZone} />
    </>
  );
}

function MovePanel({ lesson, series, timeZone, onSent, onError }: { lesson: LiveLesson; series: LiveSeries | null; timeZone: string; onSent: () => void; onError: (error: unknown) => void }) {
  const start = zonedParts(lesson.startsAt, timeZone);
  const [date, setDate] = useState(start.date);
  const [time, setTime] = useState(start.time);
  const [duration, setDuration] = useState(lesson.durationMinutes);
  const [scope, setScope] = useState<"one" | "following">("one");
  const [reason, setReason] = useState("");
  const [plan, setPlan] = useState<ReschedulePlan | null>(null);
  const [busy, setBusy] = useState(false);
  const canFollow = series !== null && !lesson.isSeriesException;
  const zone = scope === "following" && series ? series.timezone : timeZone;
  const conflicts = plan?.occurrences.filter((item) => item.conflicts).length ?? 0;

  const reset = <T,>(setter: (value: T) => void) => (value: T) => {
    setter(value);
    setPlan(null);
  };

  const send = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (scope === "following" && series) {
        if (!plan) {
          setPlan(await lessonsApi.previewSeriesMove(series, lesson.id, `${date}T${time}`, duration));
          return;
        }
        if (conflicts > 0) return;
        await lessonsApi.proposeSeriesMove(series, lesson.id, `${date}T${time}`, duration, reason);
      } else {
        await lessonsApi.propose(lesson, zonedToUtc(date, time, timeZone), duration, reason);
      }
      onSent();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 px-4 pt-4">
      <p className="m-0 rounded-xl bg-accent px-3 py-2 text-sm font-semibold text-accent-foreground">{text.move.hint}</p>
      {canFollow && (
        <Field label={text.move.scope}>
          <select className={fieldClass} value={scope} onChange={(event) => reset(setScope)(event.target.value as "one" | "following")}>
            <option value="one">{text.move.one}</option>
            <option value="following">{text.move.following}</option>
          </select>
        </Field>
      )}
      <div className="grid grid-cols-[1fr_auto_auto] gap-2">
        <Field label={text.move.date}>
          <input type="date" className={fieldClass} value={date} onChange={(event) => reset(setDate)(event.target.value)} />
        </Field>
        <Field label={text.move.time}>
          <input type="time" className={fieldClass} value={time} onChange={(event) => reset(setTime)(event.target.value)} />
        </Field>
        <Field label={text.move.duration}>
          <input type="number" min={15} max={480} step={5} className={cx(fieldClass, "w-24")} value={duration} onChange={(event) => reset(setDuration)(Number(event.target.value))} />
        </Field>
      </div>
      {series && <p className="m-0 text-xs font-semibold text-muted-foreground">{text.move.zone(zone)}</p>}
      <Field label={text.move.reason} hint={text.move.reasonHint}>
        <textarea rows={2} maxLength={500} className={cx(fieldClass, "resize-y")} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      {plan && (
        <div className="grid gap-1.5 rounded-xl border bg-card p-3" aria-live="polite">
          <b className={cx("text-sm font-extrabold", conflicts > 0 ? "text-destructive" : "text-success")}>
            {conflicts > 0 ? text.move.busy(conflicts, plan.occurrences.length) : text.move.free(plan.occurrences.length)}
          </b>
          <ul className="m-0 grid list-none gap-0.5 p-0 text-sm tabular-nums">
            {plan.occurrences.map((item) => (
              <li key={item.position} className={cx(item.conflicts && "font-bold text-destructive")}>
                {whenLabel(item.startsAt, zone)}
              </li>
            ))}
          </ul>
          {plan.preserved > 0 && <span className="text-xs font-semibold text-muted-foreground">{text.move.preserved(plan.preserved)}</span>}
        </div>
      )}
      <Button variant="primary" disabled={busy || (plan !== null && conflicts > 0)} onClick={() => void send()}>
        {scope === "following" && !plan ? text.move.check : text.move.send}
      </Button>
    </div>
  );
}

function EditPanel({ lesson, series, now, onSaved, onError }: { lesson: LiveLesson; series: LiveSeries | null; now: number; onSaved: (lesson: LiveLesson, many: boolean) => void; onError: (error: unknown) => void }) {
  const [draft, setDraft] = useState<LessonContent>({ title: lesson.title, description: lesson.description, preparation: lesson.preparation, privateNote: lesson.privateNote });
  const [scope, setScope] = useState<"one" | "series">("one");
  const [busy, setBusy] = useState(false);
  const affected = series?.lessons.filter((item) => item.usesSeriesContent && item.status === "scheduled" && Date.parse(item.startsAt) > now).length ?? 0;

  const changes = (): Partial<LessonContent> => {
    const result: Partial<LessonContent> = {};
    const norm = (value: string | null) => (value?.trim() ? value.trim() : null);
    if (draft.title.trim() !== lesson.title) result.title = draft.title.trim();
    if (norm(draft.description) !== lesson.description) result.description = norm(draft.description);
    if (norm(draft.preparation) !== lesson.preparation) result.preparation = norm(draft.preparation);
    if (norm(draft.privateNote) !== lesson.privateNote) result.privateNote = norm(draft.privateNote);
    return result;
  };

  const save = async () => {
    const diff = changes();
    if (busy || !draft.title.trim() || Object.keys(diff).length === 0) return;
    setBusy(true);
    try {
      if (scope === "series" && series) {
        await lessonsApi.updateSeriesContent(series, diff);
        onSaved(await lessonsApi.get(lesson.id), true);
      } else {
        onSaved(await lessonsApi.update(lesson, diff), false);
      }
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  const set = (key: keyof LessonContent) => (event: { target: { value: string } }) => setDraft({ ...draft, [key]: event.target.value });

  return (
    <div className="grid gap-3 px-4 pt-4">
      <Field label={text.edit.title}>
        <input className={fieldClass} value={draft.title} maxLength={200} onChange={set("title")} aria-invalid={!draft.title.trim()} />
      </Field>
      {!draft.title.trim() && <span className="text-sm font-semibold text-destructive">{text.edit.empty}</span>}
      <Field label={text.edit.description}>
        <textarea rows={2} className={cx(fieldClass, "resize-y")} value={draft.description ?? ""} onChange={set("description")} />
      </Field>
      <Field label={text.edit.preparation}>
        <textarea rows={2} className={cx(fieldClass, "resize-y")} value={draft.preparation ?? ""} onChange={set("preparation")} />
      </Field>
      <Field label={text.edit.note} hint={text.edit.noteHint}>
        <textarea rows={2} className={cx(fieldClass, "resize-y")} value={draft.privateNote ?? ""} onChange={set("privateNote")} />
      </Field>
      {series && (
        <fieldset className="m-0 grid gap-1.5 border-0 p-0">
          <legend className="mb-1 text-xs font-bold text-muted-foreground">{text.edit.scope}</legend>
          {(["one", "series"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2 text-sm font-semibold">
              <input type="radio" name="edit-scope" checked={scope === value} onChange={() => setScope(value)} />
              {value === "one" ? text.edit.one : text.edit.series}
            </label>
          ))}
          {scope === "series" && <span className="text-xs font-semibold text-muted-foreground">{text.edit.affected(affected)}</span>}
        </fieldset>
      )}
      <Button variant="primary" disabled={busy || !draft.title.trim() || Object.keys(changes()).length === 0} onClick={() => void save()}>
        {text.edit.save}
      </Button>
    </div>
  );
}

function SeriesCancelPanel({ lesson, series, future, now, timeZone, onDone, onError }: { lesson: LiveLesson; series: LiveSeries; future: LiveLesson[]; now: number; timeZone: string; onDone: () => void; onError: (error: unknown) => void }) {
  const upcoming = lesson.status === "scheduled" && Date.parse(lesson.startsAt) > now;
  const [scope, setScope] = useState<"all_future" | "following">("all_future");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const dates = scope === "following" ? future.filter((item) => (item.seriesPosition ?? 0) >= (lesson.seriesPosition ?? 0)) : future;

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await lessonsApi.cancelSeries(series, scope, scope === "following" ? lesson.id : null, reason);
      onDone();
    } catch (error) {
      onError(error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-3 px-4 pt-4">
      <Field label={text.seriesCancel.scope}>
        <select className={fieldClass} value={scope} onChange={(event) => setScope(event.target.value as "all_future" | "following")}>
          <option value="all_future">{text.seriesCancel.allFuture}</option>
          {upcoming && <option value="following">{text.seriesCancel.following}</option>}
        </select>
      </Field>
      <div className="grid gap-1 rounded-xl border bg-card p-3">
        <b className="text-sm font-extrabold">
          {text.seriesCancel.dates} · {text.seriesCancel.count(dates.length)}
        </b>
        <ul className="m-0 grid max-h-40 list-none gap-0.5 overflow-y-auto p-0 text-sm tabular-nums">
          {dates.map((item) => (
            <li key={item.id}>{whenLabel(item.startsAt, timeZone)}</li>
          ))}
        </ul>
      </div>
      <Field label={text.move.reason} hint={text.move.reasonHint}>
        <textarea rows={2} maxLength={500} className={cx(fieldClass, "resize-y")} value={reason} onChange={(event) => setReason(event.target.value)} />
      </Field>
      <Button variant="primary" disabled={busy || dates.length === 0} onClick={() => void confirm()}>
        {text.seriesCancel.confirm}
      </Button>
    </div>
  );
}
