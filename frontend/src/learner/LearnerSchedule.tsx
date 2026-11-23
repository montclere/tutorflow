import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";
import { lessonRequestsApi, type AbsenceNotice, type CabinetLesson, type LessonActivity, type RescheduleRequest } from "../cabinet/api/lessonRequests";
import { lessonsErrorCode } from "../cabinet/api/lessons";
import type { CabinetCard } from "../cabinet/api/students";
import { cabinet } from "../cabinet/content/cabinet.ru";
import { lessonsText } from "../cabinet/content/lessons.ru";
import { addDays, formatLongDay } from "../cabinet/model/dates";
import { nowIn, zonedParts, zonedToUtc } from "../cabinet/model/zoned";
import { Field, fieldClass, HistoryList, NoticesList, RequestsList, Section, whenLabel } from "../cabinet/pages/schedule/live/LessonPanels";
import { Button } from "../cabinet/ui/Button";
import { cx } from "../cabinet/ui/cx";
import { useNotifier } from "../cabinet/ui/Notifications";
import { Pill } from "../cabinet/ui/Pill";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/shared/ui/kit/sheet";

const text = lessonsText;
const errors = cabinet.teacher.schedule.live.errors;
const statusTone = { scheduled: "blue", completed: "ok", no_show: "warn", cancelled: "grey" } as const;

type Role = "student" | "parent";

/** Понедельник недели, в которую входит дата. */
export function mondayOf(date: string): string {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, day === 0 ? -6 : 1 - day);
}

/** Подпись состояния: запланированный урок после окончания — «Отметки пока нет», как у бэкенда. */
export function familyState(lesson: CabinetLesson, nowMs: number): string {
  return lesson.status === "scheduled" && Date.parse(lesson.endsAt) <= nowMs ? text.noMarkYet : text.outcome[lesson.status];
}

/**
 * Расписание ученика и родителя (SCHEDULE-15): неделя уроков по всем карточкам; в уроке — предложить перенос,
 * предупредить о неявке, ответить на перенос репетитора, лента событий. Логика — как во фронтенде бэкенда.
 */
export function LearnerSchedule({ role, cards, timezone }: { role: Role; cards: CabinetCard[]; timezone: string }) {
  const [nowMs] = useState(() => Date.now());
  const today = nowIn(timezone, nowMs).today;
  const [week, setWeek] = useState(() => mondayOf(today));
  const [lessons, setLessons] = useState<CabinetLesson[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState<CabinetLesson | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const names = new Map(cards.map((card) => [card.id, card.name]));

  useEffect(() => {
    let alive = true;
    lessonRequestsApi.lessons(role, zonedToUtc(week, "00:00", timezone), zonedToUtc(addDays(week, 7), "00:00", timezone)).then(
      (items) => {
        if (!alive) return;
        setLessons(items);
        setFailed(false);
      },
      () => alive && setFailed(true),
    );
    return () => {
      alive = false;
    };
  }, [role, week, timezone, reloadKey]);

  const days = Array.from({ length: 7 }, (_, index) => addDays(week, index));
  const byDay = (date: string) => (lessons ?? []).filter((lesson) => zonedParts(lesson.startsAt, timezone).date === date);

  return (
    <section className="grid gap-3" aria-label={text.family.title}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 font-[family-name:var(--font-display)] text-lg font-black">{text.family.title}</h2>
        <div className="flex items-center gap-1">
          <Button aria-label={text.family.prev} onClick={() => setWeek(addDays(week, -7))}>
            <ChevronLeft size={16} aria-hidden="true" />
          </Button>
          <Button onClick={() => setWeek(mondayOf(today))}>{text.family.current}</Button>
          <Button aria-label={text.family.next} onClick={() => setWeek(addDays(week, 7))}>
            <ChevronRight size={16} aria-hidden="true" />
          </Button>
        </div>
      </div>
      <p className="m-0 text-sm font-semibold text-muted-foreground tabular-nums">
        {formatLongDay(week)} — {formatLongDay(addDays(week, 6))} · {timezone}
      </p>
      {failed && (
        <p className="m-0 rounded-2xl border bg-card p-4 text-sm font-semibold" role="alert">
          {errors.unavailable}
        </p>
      )}
      {lessons !== null && lessons.length === 0 && <p className="m-0 rounded-2xl border border-dashed bg-card p-6 text-base font-semibold text-muted-foreground">{text.family.empty}</p>}
      {lessons !== null && lessons.length > 0 && (
        <ol className="m-0 grid list-none gap-2 p-0">
          {days
            .filter((date) => byDay(date).length > 0)
            .map((date) => (
              <li key={date} className="grid gap-1.5">
                <span className={cx("text-xs font-bold tracking-wide uppercase", date === today ? "text-primary" : "text-muted-foreground")}>{formatLongDay(date)}</span>
                {byDay(date).map((lesson) => (
                  <button
                    key={lesson.id}
                    type="button"
                    onClick={() => setSelected(lesson)}
                    className="glass flex w-full items-center gap-3 rounded-2xl p-3 text-left text-foreground [font-family:inherit] transition-transform hover:-translate-y-0.5"
                  >
                    <b className="w-14 font-[family-name:var(--font-display)] text-base font-extrabold tabular-nums">{zonedParts(lesson.startsAt, timezone).time}</b>
                    <span className="grid min-w-0 flex-1">
                      <b className="truncate text-sm font-extrabold">{lesson.title}</b>
                      <span className="truncate text-xs font-semibold text-muted-foreground">
                        {[names.get(lesson.cardId), `${lesson.durationMinutes} мин`].filter(Boolean).join(" · ")}
                      </span>
                    </span>
                    <Pill tone={statusTone[lesson.status]}>{familyState(lesson, nowMs)}</Pill>
                  </button>
                ))}
              </li>
            ))}
        </ol>
      )}
      <FamilyLessonSheet
        role={role}
        lesson={selected}
        timezone={timezone}
        nowMs={nowMs}
        cardName={selected ? (names.get(selected.cardId) ?? "") : ""}
        onClose={() => setSelected(null)}
        onChanged={() => setReloadKey((key) => key + 1)}
      />
    </section>
  );
}

type SheetProps = { role: Role; lesson: CabinetLesson | null; timezone: string; nowMs: number; cardName: string; onClose: () => void; onChanged: () => void };

function FamilyLessonSheet({ role, lesson, timezone, nowMs, cardName, onClose, onChanged }: SheetProps) {
  const { notify } = useNotifier();
  const [requests, setRequests] = useState<RescheduleRequest[]>([]);
  const [notices, setNotices] = useState<AbsenceNotice[]>([]);
  const [activity, setActivity] = useState<LessonActivity[]>([]);
  const [reloadKey, setReloadKey] = useState(0);
  const [panel, setPanel] = useState<"move" | "absence" | null>(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!lesson) return;
    let alive = true;
    void Promise.all([
      lessonRequestsApi.requests(role, lesson.id).catch(() => []),
      lessonRequestsApi.notices(role, lesson.id).catch(() => []),
      lessonRequestsApi.activity(role, lesson.id).catch(() => []),
    ]).then(([nextRequests, nextNotices, nextActivity]) => {
      if (!alive) return;
      setRequests(nextRequests);
      setNotices(nextNotices);
      setActivity(nextActivity);
    });
    return () => {
      alive = false;
    };
  }, [role, lesson, reloadKey]);

  const refresh = () => {
    setReloadKey((key) => key + 1);
    onChanged();
  };

  const open = (next: "move" | "absence") => {
    if (!lesson) return;
    const start = zonedParts(lesson.startsAt, timezone);
    setDate(start.date);
    setTime(start.time);
    setReason("");
    setPanel(panel === next ? null : next);
  };

  const run = async (operation: () => Promise<unknown>, done: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await operation();
      notify(done);
      setPanel(null);
      refresh();
    } catch (error) {
      notify(errors[lessonsErrorCode(error)]);
    } finally {
      setBusy(false);
    }
  };

  const upcoming = lesson !== null && lesson.status === "scheduled" && Date.parse(lesson.startsAt) > nowMs;

  return (
    <Sheet
      open={lesson !== null}
      onOpenChange={(value) => {
        if (!value) {
          setPanel(null);
          onClose();
        }
      }}
    >
      <SheetContent className="gap-0 overflow-y-auto pb-6">
        {lesson && (
          <>
            <SheetHeader className="gap-2 pr-12">
              <SheetTitle className="m-0 text-base font-extrabold">{lesson.title}</SheetTitle>
              <SheetDescription className="m-0 text-sm tabular-nums">
                {whenLabel(lesson.startsAt, timezone)} · {lesson.durationMinutes} мин{cardName ? ` · ${cardName}` : ""}
              </SheetDescription>
              <span>
                <Pill tone={statusTone[lesson.status]}>{familyState(lesson, nowMs)}</Pill>
              </span>
            </SheetHeader>
            {lesson.outcomeReason && <p className="m-0 px-4 text-sm font-semibold">{lesson.outcomeReason}</p>}
            {lesson.preparation && (
              <Section title={text.family.preparation}>
                <p className="m-0 text-sm whitespace-pre-line">{lesson.preparation}</p>
              </Section>
            )}
            {lesson.description && (
              <Section title={text.family.description}>
                <p className="m-0 text-sm whitespace-pre-line">{lesson.description}</p>
              </Section>
            )}

            {upcoming && (
              <div className="flex flex-wrap gap-1.5 px-4 pt-5">
                <Button aria-expanded={panel === "move"} onClick={() => open("move")}>
                  {text.family.propose}
                </Button>
                <Button aria-expanded={panel === "absence"} onClick={() => open("absence")}>
                  {text.family.absence}
                </Button>
              </div>
            )}
            {panel === "move" && (
              <div className="grid gap-3 px-4 pt-3">
                <div className="grid grid-cols-2 gap-2">
                  <Field label={text.move.date}>
                    <input type="date" className={fieldClass} value={date} onChange={(event) => setDate(event.target.value)} />
                  </Field>
                  <Field label={text.move.time}>
                    <input type="time" className={fieldClass} value={time} onChange={(event) => setTime(event.target.value)} />
                  </Field>
                </div>
                <Field label={text.move.reason}>
                  <textarea rows={2} maxLength={500} className={cx(fieldClass, "resize-y")} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
                <Button variant="primary" disabled={busy || !date || !time} onClick={() => void run(() => lessonRequestsApi.proposeFamily(role, lesson, zonedToUtc(date, time, timezone), reason), text.move.sent)}>
                  {text.move.send}
                </Button>
              </div>
            )}
            {panel === "absence" && (
              <div className="grid gap-3 px-4 pt-3">
                <p className="m-0 rounded-xl bg-[var(--cab-warn-soft)] px-3 py-2 text-sm font-semibold">{text.family.absenceHint}</p>
                <Field label={text.move.reason}>
                  <textarea rows={2} maxLength={500} className={cx(fieldClass, "resize-y")} value={reason} onChange={(event) => setReason(event.target.value)} />
                </Field>
                <Button variant="primary" disabled={busy} onClick={() => void run(() => lessonRequestsApi.sendNotice(role, lesson, reason), text.family.absenceSent)}>
                  {text.family.absence}
                </Button>
              </div>
            )}

            <RequestsList cabinet={role} items={requests} timeZone={timezone} onDone={refresh} />
            <NoticesList cabinet={role} items={notices} onDone={refresh} />
            <HistoryList items={activity.map((item) => ({ event: item.event, occurredAt: item.occurredAt, who: item.actorRole ? text.roles[item.actorRole] : null }))} timeZone={timezone} />
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
