import { useMemo, useState } from "react";
import { toScheduleLesson, type LiveLesson } from "../../api/lessons";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import type { ScheduleLesson } from "../../mocks/types";
import { formatShortDate } from "../../model/dates";
import { liveOverview, overviewRange } from "../../model/liveOverview";
import { nowIn } from "../../model/zoned";
import { useSession } from "../../session/SessionContext";
import { Avatar } from "../../ui/Avatar";
import { Button } from "../../ui/Button";
import { CabinetLink } from "../../ui/CabinetLink";
import { Card } from "../../ui/Card";
import { EmptyState } from "../../ui/EmptyState";
import { PageHead } from "../../ui/PageHead";
import { LiveLessonSheet } from "../schedule/live/LiveLessonSheet";
import { livePeople } from "../schedule/live/livePeople";
import { useLiveSchedule } from "../schedule/live/useLiveSchedule";
import { lessonTime } from "../schedule/LessonMeta";
import { scheduleHref } from "../schedule/useScheduleUrl";
import type { SchedulePeople } from "../schedule/schedulePeople";

const text = cabinet.teacher.overview;
const live = text.live;

function LessonList({ lessons, people, withDate, onOpen }: { lessons: ScheduleLesson[]; people: SchedulePeople; withDate?: boolean; onOpen: (id: string) => void }) {
  return (
    <ul className="m-0 grid list-none gap-1 p-0">
      {lessons.map((lesson) => {
        const person = people.personOf(lesson);
        const time = withDate ? `${formatShortDate(lesson.date)}, ${lesson.start}` : lessonTime(lesson);
        return (
          <li key={lesson.id}>
            <button
              type="button"
              aria-label={live.openLesson(person.name, time)}
              onClick={() => onOpen(lesson.id)}
              className="-mx-2 flex w-[calc(100%+1rem)] appearance-none items-center gap-3 rounded-xl border-0 bg-transparent px-2 py-2.5 text-left text-inherit [font:inherit] transition-colors hover:bg-secondary"
            >
              <span className="w-24 flex-none text-sm font-extrabold tabular-nums">{time}</span>
              <Avatar initials={person.initials} color={person.color} />
              <span className="min-w-0 flex-1">
                <b className="block truncate text-base font-extrabold">{person.name}</b>
                <span className="block truncate text-sm font-semibold text-muted-foreground">{person.goal}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Count({ label, value }: { label: string; value: number }) {
  return (
    <div className="grid gap-0.5 rounded-xl bg-secondary/60 p-3">
      <span className="text-xs font-bold text-muted-foreground">{label}</span>
      <b className="font-[family-name:var(--font-display)] text-2xl font-black tabular-nums">{value}</b>
    </div>
  );
}

/** Обзор рабочей сборки — из настоящих уроков: что впереди, что отметить, как прошла неделя. */
export function LiveOverviewPage() {
  const { displayName, timezone } = useSession();
  const { today, now } = nowIn(timezone);
  const { state, reload, retry, apply } = useLiveSchedule(overviewRange(today), timezone);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ready = state.kind === "ready" ? state : null;
  const lessonsById = useMemo(() => new Map((ready?.lessons ?? []).map((lesson) => [lesson.id, lesson])), [ready?.lessons]);
  const cardsById = useMemo(() => new Map((ready?.cards ?? []).map((card) => [card.id, card])), [ready?.cards]);
  const people = useMemo(() => livePeople(lessonsById, cardsById), [lessonsById, cardsById]);
  const view = useMemo(() => liveOverview((ready?.lessons ?? []).map((lesson) => toScheduleLesson(lesson, timezone)), today, now), [ready?.lessons, timezone, today, now]);
  const firstName = displayName.trim().split(/\s+/)[0] ?? displayName;

  const content = () => {
    if (state.kind === "loading") {
      return (
        <p className="m-0 py-10 text-center text-sm font-bold text-muted-foreground" role="status">
          {cabinet.teacher.schedule.live.loading}
        </p>
      );
    }
    if (state.kind === "failed") return <EmptyState title={cabinet.teacher.schedule.live.failed} action={<Button onClick={retry}>{cabinet.teacher.schedule.live.retry}</Button>} />;
    if (state.cards.length === 0) {
      return (
        <EmptyState
          title={live.firstTitle}
          text={live.firstText}
          action={
            <CabinetLink href={teacherRoutes.students} className="inline-flex h-9 items-center rounded-md bg-primary px-4 text-sm font-bold text-primary-foreground no-underline">
              {live.firstAction}
            </CabinetLink>
          }
        />
      );
    }
    const scheduleLink = (
      <CabinetLink href={scheduleHref("week", today, today)} className="text-sm font-bold text-primary no-underline">
        {live.schedule}
      </CabinetLink>
    );
    return (
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <Card title={live.upcomingTitle} action={scheduleLink}>
          {view.today.length === 0 && view.tomorrow.length === 0 ? (
            <p className="m-0 text-sm font-semibold text-muted-foreground">{live.noUpcoming}</p>
          ) : (
            <div className="grid gap-4">
              {view.today.length > 0 && (
                <section className="grid gap-1">
                  <h3 className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">{live.today}</h3>
                  <LessonList lessons={view.today} people={people} onOpen={setSelectedId} />
                </section>
              )}
              {view.tomorrow.length > 0 && (
                <section className="grid gap-1">
                  <h3 className="m-0 text-xs font-bold tracking-wide text-muted-foreground uppercase">{live.tomorrow}</h3>
                  <LessonList lessons={view.tomorrow} people={people} onOpen={setSelectedId} />
                </section>
              )}
            </div>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card title={live.toMarkTitle} subtitle={view.toMark.length > 0 ? live.toMarkHint : undefined}>
            {view.toMark.length === 0 ? (
              <p className="m-0 text-sm font-semibold text-muted-foreground">{live.allMarked}</p>
            ) : (
              <LessonList lessons={view.toMark} people={people} withDate onOpen={setSelectedId} />
            )}
          </Card>
          <Card title={live.weekTitle}>
            <div className="grid grid-cols-2 gap-2">
              <Count label={live.week.planned} value={view.week.planned} />
              <Count label={live.week.completed} value={view.week.completed} />
              <Count label={live.week.noShow} value={view.week.noShow} />
              <Count label={live.week.cancelled} value={view.week.cancelled} />
            </div>
          </Card>
        </div>
      </div>
    );
  };

  const selected: LiveLesson | null = selectedId ? (lessonsById.get(selectedId) ?? null) : null;

  return (
    <>
      <PageHead title={text.greeting(firstName)} />
      {content()}
      <LiveLessonSheet
        lesson={selected}
        card={selected ? (cardsById.get(selected.cardId) ?? null) : null}
        timeZone={timezone}
        onClose={() => setSelectedId(null)}
        onChanged={(lesson) => apply([lesson])}
        onConflict={() => void reload()}
      />
    </>
  );
}
