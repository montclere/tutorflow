import { useState, type ReactNode } from "react";
import { cabinet } from "../content/cabinet.ru";
import { PrintHost } from "../pages/tasks/PrintSheet";
import { NotificationsProvider } from "../ui/Notifications";
import { roleOfPath } from "./roleOfPath";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import styles from "./layout.module.css";

export function CabinetShell({ pathname, children }: { pathname: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const role = roleOfPath(pathname);

  return (
    <NotificationsProvider>
      <div className={styles.app}>
        <a className={styles.skip} href="#cabinet-main">
          {cabinet.shell.skip}
        </a>
        <Sidebar role={role} pathname={pathname} open={menuOpen} onClose={() => setMenuOpen(false)} />
        <div className={styles.main}>
          <Topbar role={role} menuOpen={menuOpen} onToggleMenu={() => setMenuOpen((value) => !value)} />
          <main id="cabinet-main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </div>
      <PrintHost />
    </NotificationsProvider>
  );
}
