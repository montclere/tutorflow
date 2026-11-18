import { useEffect, type ReactNode } from "react";
import { env } from "../config/env";
import { teacherRoutes, studentRoutes } from "../config/routes";
import { CabinetShell } from "./layout/CabinetShell";
import { ExamPage } from "./pages/ExamPage";
import { FinancePage } from "./pages/finance/FinancePage";
import { HomeworkPage } from "./pages/HomeworkPage";
import { OverviewPage } from "./pages/overview/OverviewPage";
import { ProgressPage } from "./pages/ProgressPage";
import { ReviewPage } from "./pages/ReviewPage";
import { SchedulePage } from "./pages/schedule/SchedulePage";
import { StudentHomePage } from "./pages/StudentHomePage";
import { StudentsPage } from "./pages/students/StudentsPage";
import { TasksPage } from "./pages/TasksPage";
import { TrainerPage } from "./pages/TrainerPage";
import { SessionGate } from "./session/SessionGate";
import { SoonPage } from "./session/SoonPage";

// Разделы без маршрутов API: в демо-сборке — тестовые данные, в рабочей — «скоро» (INF-7.2, ADR интерфейса).
const demoOnly = (screen: ReactNode, section: "finance" | "tasks" | "review" | "student") => () => (env.demo ? screen : <SoonPage section={section} />);

const screens: Record<string, () => ReactNode> = {
  [teacherRoutes.overview]: () => <OverviewPage />,
  [teacherRoutes.schedule]: () => <SchedulePage />,
  [teacherRoutes.students]: () => <StudentsPage />,
  [teacherRoutes.tasksCreate]: demoOnly(<TasksPage tab="create" />, "tasks"),
  [teacherRoutes.tasksBank]: demoOnly(<TasksPage tab="bank" />, "tasks"),
  [teacherRoutes.tasksMine]: demoOnly(<TasksPage tab="mine" />, "tasks"),
  [teacherRoutes.review]: demoOnly(<ReviewPage />, "review"),
  [teacherRoutes.finance]: demoOnly(<FinancePage />, "finance"),
  [studentRoutes.home]: demoOnly(<StudentHomePage />, "student"),
  [studentRoutes.tasks]: demoOnly(<HomeworkPage />, "student"),
  [studentRoutes.trainer]: demoOnly(<TrainerPage />, "student"),
  [studentRoutes.exam]: demoOnly(<ExamPage />, "student"),
  [studentRoutes.progress]: demoOnly(<ProgressPage />, "student"),
};

export function isCabinetPath(pathname: string) {
  return pathname in screens;
}

export function CabinetApp({ pathname }: { pathname: string }) {
  useEffect(() => {
    const previous = document.title;
    document.title = "TutorFlow — кабинет";
    return () => {
      document.title = previous;
    };
  }, []);

  const screen = screens[pathname];
  return (
    <SessionGate>
      <CabinetShell pathname={pathname}>{screen?.()}</CabinetShell>
    </SessionGate>
  );
}
