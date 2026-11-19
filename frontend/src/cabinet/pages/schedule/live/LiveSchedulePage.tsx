import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { toScheduleLesson, type LiveLesson } from "../../../api/lessons";
import { cabinet } from "../../../content/cabinet.ru";
import type { ScheduleData } from "../../../mocks/types";
import { cardColor } from "../../../model/cardColor";
import { addDays } from "../../../model/dates";
import { upcomingFreeWindows } from "../../../model/freeSlots";
import { filterLessons, lessonsBetween, type LessonFilters } from "../../../model/lessons";
import { initialsOf } from "../../../model/newStudent";
import { workHoursFor } from "../../../model/scheduleLayout";
import { viewRange } from "../../../model/scheduleRange";
import { nowIn } from "../../../model/zoned";
import { useSession } from "../../../session/SessionContext";
import { Button } from "../../../ui/Button";
import { EmptyState } from "../../../ui/EmptyState";
import { DayView } from "../DayView";
import { ListView } from "../ListView";
import { MonthView } from "../MonthView";
import { ScheduleFilters } from "../ScheduleFilters";
import { ScheduleHeader } from "../ScheduleHeader";
import { SchedulePeopleContext } from "../schedulePeople";
import { useScheduleUrl } from "../useScheduleUrl";
import { WeekView } from "../WeekView";
import { LiveLessonSheet } from "./LiveLessonSheet";
import { LiveNewLessonSheet, type LiveLessonSeed } from "./LiveNewLessonSheet";
import { livePeople } from "./livePeople";
import { useLiveSchedule } from "./useLiveSchedule";

const text = cabinet.teacher.schedule;
const noFilters: LessonFilters = { studentId: null, type: null };
/** Базовая сетка дня рабочей сборки; уроки вне её расширяют сетку. */
const BASE_HOURS = { start: "09:00", end: "21:00", minFreeWindowMin: 90 };

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

/** Расписание рабочей сборки: те же виды, что в демо, но уроки и действия — по API lessons. */
export function LiveSchedulePage() {
  const { timezone } = useSession();
  const { today, now } = nowIn(timezone);
  const { view, date, go } = useScheduleUrl(today);
  const range = viewRange(view, date);
  const { state, reload, retry, apply } = useLiveSchedule(range, timezone);
  const [filters, setFilters] = useState<LessonFilters>(noFilters);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newLesson, setNewLesson] = useState<LiveLessonSeed | null>(null);

  const ready = state.kind === "ready" ? state : null;
  const lessonsById = useMemo(() => new Map((ready?.lessons ?? []).map((lesson) => [lesson.id, lesson])), [ready?.lessons]);
  const cardsById = useMemo(() => new Map((ready?.cards ?? []).map((card) => [card.id, card])), [ready?.cards]);
  const people = useMemo(() => livePeople(lessonsById, cardsById), [lessonsById, cardsById]);
  const scheduleLessons = useMemo(() => (ready?.lessons ?? []).map((lesson) => toScheduleLesson(lesson, timezone)), [ready?.lessons, timezone]);
  const lessons = useMemo(() => filterLessons(scheduleLessons, filters), [scheduleLessons, filters]);

  // Отменённый урок время не занимает: data.lessons — для свободных окон.
  const busyLessons = scheduleLessons.filter((lesson) => lesson.status !== "cancelled");
  const work = workHoursFor(BASE_HOURS, scheduleLessons);
  const data: ScheduleData = { today, now, work, lessons: busyLessons };
  const lessonCount = lessonsBetween(lessons, range.from, range.to).filter((lesson) => lesson.status !== "cancelled").length;
  const windowCount = upcomingFreeWindows(busyLessons, eachDate(range.from, range.to), BASE_HOURS, today, now).length;
  const filterStudents = (ready?.cards ?? []).filter((card) => card.status === "active").map((card) => ({ id: card.id, name: card.name, initials: initialsOf(card.name), color: cardColor(card.id) }));

  const openNew = (seed: Omit<LiveLessonSeed, "cardId">) => setNewLesson({ ...seed, cardId: filters.studentId ?? undefined });
  const onCreated = (created: LiveLesson[]) => {
    setNewLesson(null);
    apply(created);
    const first = created[0];
    if (first) go({ date: toScheduleLesson(first, timezone).date });
  };

  const body = () => {
    if (state.kind === "loading") {
      return (
        <p className="m-0 py-10 text-center text-sm font-bold text-muted-foreground" role="status">
          {text.live.loading}
        </p>
      );
    }
    if (state.kind === "failed") return <EmptyState emoji="😕" title={text.live.failed} action={<Button onClick={retry}>{text.live.retry}</Button>} />;
    const open = (lesson: { id: string }) => setSelectedId(lesson.id);
    return (
      <>
        {view === "week" && <WeekView data={data} lessons={lessons} date={date} onOpen={open} onCreate={(day, start) => openNew({ date: day, start })} />}
        {view === "day" && <DayView data={data} lessons={lessons} date={date} onOpen={open} />}
        {view === "month" && <MonthView lessons={lessons} date={date} today={today} onPick={(next) => go({ view: "day", date: next })} />}
        {view === "list" && <ListView data={data} lessons={lessonsBetween(lessons, range.from, range.to)} filtered={filters.studentId !== null} onOpen={open} />}
      </>
    );
  };

  const selected = selectedId ? (lessonsById.get(selectedId) ?? null) : null;

  return (
    <SchedulePeopleContext.Provider value={people}>
      <ScheduleHeader view={view} date={date} today={today} onChange={go} onAdd={() => openNew({ date })} />
      <ScheduleFilters students={filterStudents} showType={false} filters={filters} summary={text.summary(lessonCount, windowCount)} onFilters={setFilters} />
      {body()}
      <Button variant="primary" icon={Plus} className="fixed right-4 bottom-4 z-40 h-12 rounded-full px-5 shadow-lg min-[521px]:hidden" onClick={() => openNew({ date })}>
        {text.addLesson}
      </Button>
      <LiveLessonSheet
        lesson={selected}
        card={selected ? (cardsById.get(selected.cardId) ?? null) : null}
        timeZone={timezone}
        onClose={() => setSelectedId(null)}
        onChanged={(lesson) => apply([lesson])}
        onConflict={() => void reload()}
      />
      <LiveNewLessonSheet seed={newLesson} cards={ready?.cards ?? []} timeZone={timezone} onClose={() => setNewLesson(null)} onCreated={onCreated} />
    </SchedulePeopleContext.Provider>
  );
}
