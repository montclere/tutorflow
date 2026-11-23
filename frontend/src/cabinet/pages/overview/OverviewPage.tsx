import { useState } from "react";
import { getSchedule, getTeacherOverview } from "../../data";
import type { ScheduleLesson } from "../../mocks/types";
import { LessonSheet } from "../schedule/LessonSheet";
import { AttentionCard } from "./AttentionCard";
import { MainHeading } from "./MainHeading";
import styles from "./overview.module.css";
import { OverviewHighlights } from "./OverviewHighlights";
import { TodayCard } from "./TodayCard";
import { WeekCard } from "./WeekCard";

export function OverviewPage() {
  const data = getTeacherOverview();
  const schedule = getSchedule();
  // Та же карточка урока, что в расписании (OVERVIEW-4).
  const [selected, setSelected] = useState<ScheduleLesson | null>(null);
  const openLesson = (id: string) => setSelected(schedule.lessons.find((lesson) => lesson.id === id) ?? null);

  return (
    <>
      <div className={styles.page}>
      <MainHeading today={schedule.today} />
      <OverviewHighlights data={data} />
      <div className={styles.columns}>
        <TodayCard
          lessons={{ today: data.today, tomorrow: data.tomorrow }}
          freeWindows={data.week.freeWindows}
          today={schedule.today}
          onOpen={openLesson}
        />
        <div className={styles.right}>
          <AttentionCard items={data.attention} />
          <WeekCard week={data.week} today={schedule.today} />
        </div>
      </div>
      </div>
      <LessonSheet lesson={selected} onClose={() => setSelected(null)} />
    </>
  );
}
