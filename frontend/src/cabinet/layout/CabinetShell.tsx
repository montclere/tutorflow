import { useState, type ReactNode } from "react";
import { cabinet } from "../content/cabinet.ru";
import { PrintHost } from "../pages/tasks/PrintSheet";
import { NotificationsProvider } from "../ui/Notifications";
import { studentRoutes, teacherRoutes } from "../../config/routes";
import { cx } from "../ui/cx";
import { roleOfPath } from "./roleOfPath";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import styles from "./layout.module.css";

export function CabinetShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = roleOfPath(pathname);
  const isStudentHome = pathname === studentRoutes.home;
  const isStudio = [teacherRoutes.tasksCreate, teacherRoutes.tasksBank, teacherRoutes.tasksMine, teacherRoutes.review].some((path) => pathname === path);

  return (
    <NotificationsProvider>
      <div className={cx(styles.app, (pathname === teacherRoutes.overview || pathname === teacherRoutes.schedule || pathname === teacherRoutes.students || pathname === teacherRoutes.finance || isStudio) && styles.home, pathname === teacherRoutes.schedule && styles.schedule, pathname === teacherRoutes.students && styles.students, pathname === teacherRoutes.finance && styles.finance, isStudio && styles.studio, isStudentHome && styles.studentMain)}>
        <a className={styles.skip} href="#cabinet-main">
          {cabinet.shell.skip}
        </a>
        <Topbar role={role} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((value) => !value)} />
        <Sidebar role={role} pathname={pathname} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className={styles.main}>
          <main id="cabinet-main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <PrintHost />
    </NotificationsProvider>
  );
}
