import { Plus } from "lucide-react";
import { useMemo, useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getStudents } from "../../data";
import { useSchedule } from "../../data/useSchedule";
import type { ScheduleLesson } from "../../mocks/types";
import { upcomingFreeWindows } from "../../model/freeSlots";
import { filterLessons, lessonsBetween, type LessonFilters } from "../../model/lessons";
import { addDays } from "../../model/dates";
import { Button } from "../../ui/Button";
import { viewRange } from "../../model/scheduleRange";
import { DayView } from "./DayView";
import { LessonSheet } from "./LessonSheet";
import { ListView } from "./ListView";
import { MonthView } from "./MonthView";
import { NewLessonSheet, type NewLessonSeed } from "./NewLessonSheet";
import { ScheduleFilters } from "./ScheduleFilters";
import { ScheduleHeader } from "./ScheduleHeader";
import { useScheduleUrl } from "./useScheduleUrl";
import { WeekView } from "./WeekView";

const text = cabinet.teacher.schedule;
const noFilters: LessonFilters = { studentId: null, type: null };

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function SchedulePage() {
  const data = useSchedule();
  const students = getStudents();
  const { view, date, go } = useScheduleUrl(data.today);
  const [filters, setFilters] = useState<LessonFilters>(noFilters);
  const [selected, setSelected] = useState<ScheduleLesson | null>(null);
  const [newLesson, setNewLesson] = useState<NewLessonSeed | null>(null);

  const lessons = useMemo(() => filterLessons(data.lessons, filters), [data.lessons, filters]);
  const range = viewRange(view, date);
  const lessonCount = lessonsBetween(lessons, range.from, range.to).length;
  const windowCount = upcomingFreeWindows(data.lessons, eachDate(range.from, range.to), data.work, data.today, data.now).length;
  const isFiltered = filters.studentId !== null || filters.type !== null;

  return (
    <>
      <ScheduleHeader view={view} date={date} today={data.today} onChange={go} onAdd={() => setNewLesson({ date, studentId: filters.studentId ?? undefined })} />
      <ScheduleFilters
        students={students}
        filters={filters}
        summary={text.summary(lessonCount, windowCount)}
        lessonCount={lessonCount}
        windowCount={windowCount}
        onFilters={setFilters}
      />
      {view === "week" && (
        <WeekView data={data} lessons={lessons} date={date} onOpen={setSelected} onCreate={(day, start) => setNewLesson({ date: day, start, studentId: filters.studentId ?? undefined })} />
      )}
      {view === "day" && <DayView data={data} lessons={lessons} date={date} onOpen={setSelected} />}
      {view === "month" && <MonthView lessons={lessons} date={date} today={data.today} onPick={(next) => go({ view: "day", date: next })} />}
      {view === "list" && <ListView data={data} lessons={lessonsBetween(lessons, range.from, range.to)} filtered={isFiltered} onOpen={setSelected} />}
      {/* На телефоне «+ Урок» — плавающая кнопка внизу, а не ещё одна строка шапки. */}
      <Button
        variant="primary"
        icon={Plus}
        className="fixed right-4 bottom-4 z-40 h-12 rounded-full px-5 shadow-lg min-[521px]:hidden"
        onClick={() => setNewLesson({ date, studentId: filters.studentId ?? undefined })}
      >
        {text.addLesson}
      </Button>
      <LessonSheet lesson={selected} onClose={() => setSelected(null)} />
      <NewLessonSheet
        seed={newLesson}
        onClose={() => setNewLesson(null)}
        onCreated={(created) => {
          // Показываем день, на который поставили первый урок.
          const first = created[0];
          if (first) go({ date: first.date });
        }}
      />
    </>
  );
}
