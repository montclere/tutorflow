import { CalendarDays, ClipboardCheck, Home, Layers, Users, Wallet } from "lucide-react";
import { env } from "../../config/env";
import { cabinet, type Role } from "../content/cabinet.ru";
import { CabinetLink } from "../ui/CabinetLink";
import { cx } from "../ui/cx";
import { NavIcon } from "../ui/Icon";
import { teacherRoutes } from "../../config/routes";
import { useLibrary } from "../tasks/library";
import styles from "./layout.module.css";

type Props = { role: Role; pathname: string; open: boolean; onClose: () => void };

function isActive(pathname: string, path: string, prefix?: string) {
  return prefix ? pathname.startsWith(prefix) : pathname === path;
}

export function Sidebar({ role, pathname, open, onClose }: Props) {
  // Сколько работ ждут проверки — число у «Проверки» (REVIEW-1).
  const waiting = useLibrary().assignments.filter((assignment) => assignment.status === "wait").length;
  const promo = cabinet.promo[role];
  const mainIcons = { home: Home, calendar: CalendarDays, users: Users, tasks: Layers, check: ClipboardCheck, money: Wallet };

  return (
    <aside id="cabinet-menu" className={cx(styles.side, open && styles.sideOpen)} aria-label={cabinet.shell.menuLabel}>
      <nav className={styles.nav} aria-label={cabinet.shell.menuLabel}>
        {cabinet.nav[role].map((item) => (
          <CabinetLink
            key={item.path}
            href={item.path}
            aria-current={isActive(pathname, item.path, item.matchPrefix) ? "page" : undefined}
            onClick={onClose}
          >
            {item.icon in mainIcons ? (() => { const Icon = mainIcons[item.icon as keyof typeof mainIcons]; return <Icon size={20} aria-hidden="true" />; })() : <NavIcon name={item.icon} />}
            {item.label}
            {env.demo && (item.path === teacherRoutes.review ? waiting > 0 : item.badge) && <span className={styles.count}>{item.path === teacherRoutes.review ? waiting : item.badge}</span>}
          </CabinetLink>
        ))}
      </nav>

      {env.demo && (
        <div className={styles.promo}>
          <b>{promo.title}</b>
          {promo.text}
        </div>
      )}
    </aside>
  );
}
