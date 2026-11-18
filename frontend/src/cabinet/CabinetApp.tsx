import { useEffect, type ReactNode } from "react";
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

const screens: Record<string, () => ReactNode> = {
  [teacherRoutes.overview]: () => <OverviewPage />,
  [teacherRoutes.schedule]: () => <SchedulePage />,
  [teacherRoutes.students]: () => <StudentsPage />,
  [teacherRoutes.tasksCreate]: () => <TasksPage tab="create" />,
  [teacherRoutes.tasksBank]: () => <TasksPage tab="bank" />,
  [teacherRoutes.tasksMine]: () => <TasksPage tab="mine" />,
  [teacherRoutes.review]: () => <ReviewPage />,
  [teacherRoutes.finance]: () => <FinancePage />,
  [studentRoutes.home]: () => <StudentHomePage />,
  [studentRoutes.tasks]: () => <HomeworkPage />,
  [studentRoutes.trainer]: () => <TrainerPage />,
  [studentRoutes.exam]: () => <ExamPage />,
  [studentRoutes.progress]: () => <ProgressPage />,
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
  return <CabinetShell pathname={pathname}>{screen?.()}</CabinetShell>;
}
