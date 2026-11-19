import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getSchedule, getTeacherOverview } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { useLibrary } from "../../tasks/library";
import { LessonSheet } from "../schedule/LessonSheet";
import { AttentionCard } from "./AttentionCard";
import { Greeting } from "./Greeting";
import { OverviewHighlights } from "./OverviewHighlights";
import { TodayCard } from "./TodayCard";
import { WeekCard } from "./WeekCard";

const text = cabinet.teacher.overview;

export function OverviewPage() {
  const data = getTeacherOverview();
  const schedule = getSchedule();
  // Та же карточка урока, что в расписании (OVERVIEW-4).
  const [selected, setSelected] = useState<ScheduleLesson | null>(null);
  const waiting = useLibrary().assignments.filter((assignment) => assignment.status === "wait").length;
  const openLesson = (id: string) => setSelected(schedule.lessons.find((lesson) => lesson.id === id) ?? null);

  return (
    <>
      <Greeting
        name={data.teacherName}
        today={schedule.today}
        now={schedule.now}
        summary={text.hello.summary(data.today.length, data.today.find((row) => !row.past)?.time ?? null, waiting)}
      />
      <OverviewHighlights data={data} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TodayCard
          lessons={{ today: data.today, tomorrow: data.tomorrow }}
          freeWindows={data.week.freeWindows}
          today={schedule.today}
          onOpen={openLesson}
        />
        <div className="flex flex-col gap-4">
          <AttentionCard items={data.attention} />
          <WeekCard week={data.week} today={schedule.today} />
        </div>
      </div>
      <LessonSheet lesson={selected} onClose={() => setSelected(null)} />
    </>
  );
}
