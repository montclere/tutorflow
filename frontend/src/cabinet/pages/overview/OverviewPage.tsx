import { useState } from "react";
import { cabinet } from "../../content/cabinet.ru";
import { getSchedule, getTeacherOverview } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { PageHead } from "../../ui/PageHead";
import { LessonSheet } from "../schedule/LessonSheet";
import { AttentionCard } from "./AttentionCard";
import { TodayCard } from "./TodayCard";
import { WeekCard } from "./WeekCard";

const text = cabinet.teacher.overview;

export function OverviewPage() {
  const data = getTeacherOverview();
  const schedule = getSchedule();
  // Та же карточка урока, что в расписании (OVERVIEW-4).
  const [selected, setSelected] = useState<ScheduleLesson | null>(null);
  const openLesson = (id: string) => setSelected(schedule.lessons.find((lesson) => lesson.id === id) ?? null);

  return (
    <>
      <PageHead title={text.greeting(data.teacherName)} />
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
