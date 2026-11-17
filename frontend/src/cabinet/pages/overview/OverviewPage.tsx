import { cabinet } from "../../content/cabinet.ru";
import { getTeacherOverview } from "../../data";
import { PageHead } from "../../ui/PageHead";
import { AttentionCard } from "./AttentionCard";
import { TodayCard } from "./TodayCard";
import { WeekCard } from "./WeekCard";

const text = cabinet.teacher.overview;

export function OverviewPage() {
  const data = getTeacherOverview();

  return (
    <>
      <PageHead title={text.greeting(data.teacherName)} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <TodayCard lessons={{ today: data.today, tomorrow: data.tomorrow }} />
        <div className="flex flex-col gap-4">
          <AttentionCard items={data.attention} />
          <WeekCard week={data.week} />
        </div>
      </div>
    </>
  );
}
