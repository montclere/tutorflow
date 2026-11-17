import { Plus } from "lucide-react";
import { navigate } from "../../../app/router";
import { teacherRoutes } from "../../../config/routes";
import { cabinet } from "../../content/cabinet.ru";
import { getTeacherOverview } from "../../data";
import { Button } from "../../ui/Button";
import { cx } from "../../ui/cx";
import { useNotifier } from "../../ui/Notifications";
import { PageHead } from "../../ui/PageHead";
import { AttentionCard } from "./AttentionCard";
import { ExamsCard } from "./ExamsCard";
import { TodayCard } from "./TodayCard";
import { WeekCard } from "./WeekCard";

const text = cabinet.teacher.overview;

export function OverviewPage() {
  const { notifySoon } = useNotifier();
  const data = getTeacherOverview();
  const hasExams = data.exams.length > 0;

  return (
    <>
      <PageHead
        title={text.greeting(data.teacherName)}
        subtitle={data.date}
        actions={
          <>
            <Button icon={Plus} onClick={() => navigate(teacherRoutes.tasksCreate)}>
              {text.addTask}
            </Button>
            <Button variant="primary" icon={Plus} onClick={() => notifySoon(text.addLesson)}>
              {text.addLesson}
            </Button>
          </>
        }
      />
      <div className="flex flex-col gap-4">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 min-[1181px]:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <TodayCard lessons={{ today: data.today, tomorrow: data.tomorrow }} />
          <AttentionCard items={data.attention} />
        </div>
        <div className={cx("grid grid-cols-[minmax(0,1fr)] gap-4", hasExams && "min-[1181px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]")}>
          <WeekCard week={data.week} />
          {hasExams && <ExamsCard exams={data.exams} />}
        </div>
      </div>
    </>
  );
}
