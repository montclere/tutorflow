import { useMemo, useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getAllStudents, getSchedule, getTeacherSubjects } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { upcomingFreeWindows } from "../../model/freeSlots";
import { filterLessons, lessonsBetween, type LessonFilters } from "../../model/lessons";
import { addDays } from "../../model/dates";
import { viewRange } from "../../model/scheduleRange";
import { DayView } from "./DayView";
import { LessonSheet } from "./LessonSheet";
import { ListView } from "./ListView";
import { MonthView } from "./MonthView";
import { ScheduleFilters } from "./ScheduleFilters";
import { ScheduleHeader } from "./ScheduleHeader";
import { useScheduleUrl } from "./useScheduleUrl";
import { WeekView } from "./WeekView";

const text = cabinet.teacher.schedule;
const noFilters: LessonFilters = { studentId: null, type: null, subject: null };

function eachDate(from: string, to: string): string[] {
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function SchedulePage() {
  const data = getSchedule();
  const students = getAllStudents();
  const subjects = getTeacherSubjects();
  const { view, date, go } = useScheduleUrl(data.today);
  const [filters, setFilters] = useState<LessonFilters>(noFilters);
  const [selected, setSelected] = useState<ScheduleLesson | null>(null);

  const lessons = useMemo(() => filterLessons(data.lessons, filters, students), [data.lessons, filters, students]);
  const range = viewRange(view, date);
  const lessonCount = lessonsBetween(lessons, range.from, range.to).length;
  const windowCount = upcomingFreeWindows(data.lessons, eachDate(range.from, range.to), data.work, data.today, data.now).length;
  const isFiltered = filters.studentId !== null || filters.type !== null || filters.subject !== null;

  return (
    <>
      <ScheduleHeader view={view} date={date} today={data.today} onChange={go} />
      <ScheduleFilters
        students={students}
        subjects={subjects}
        filters={filters}
        summary={text.summary(lessonCount, windowCount)}
        onFilters={setFilters}
      />
      {view === "week" && <WeekView data={data} lessons={lessons} date={date} onOpen={setSelected} />}
      {view === "day" && <DayView data={data} lessons={lessons} date={date} onDate={(next) => go({ date: next })} onOpen={setSelected} />}
      {view === "month" && <MonthView lessons={lessons} date={date} today={data.today} onPick={(next) => go({ view: "day", date: next })} />}
      {view === "list" && <ListView data={data} lessons={lessonsBetween(lessons, range.from, range.to)} filtered={isFiltered} onOpen={setSelected} />}
      <LessonSheet lesson={selected} onClose={() => setSelected(null)} />
    </>
  );
}
