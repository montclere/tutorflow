import { Bell, Menu } from "lucide-react";
import { studentPerson, teacherPerson } from "../mocks/people";
import { cabinet, type Role } from "../content/cabinet.ru";
import { Avatar } from "../ui/Avatar";
import { IconButton } from "../ui/Button";
import { useNotifier } from "../ui/Notifications";
import styles from "./layout.module.css";

type Props = { role: Role; menuOpen: boolean; onToggleMenu: () => void };

export function Topbar({ role, menuOpen, onToggleMenu }: Props) {
  const { notifySoon } = useNotifier();
  const person = role === "teacher" ? teacherPerson : studentPerson;

  return (
    <header className={styles.top}>
      <div className={styles.topLeft}>
        <IconButton
          icon={Menu}
          label={menuOpen ? cabinet.shell.closeMenu : cabinet.shell.openMenu}
          className={styles.burger}
          aria-expanded={menuOpen}
          aria-controls="cabinet-menu"
          onClick={onToggleMenu}
        />
      </div>
      <div className={styles.me}>
        <span className={styles.bell}>
          <IconButton icon={Bell} label={cabinet.shell.notificationsLabel} onClick={() => notifySoon(cabinet.shell.notificationsLabel)} />
          <i className={styles.dot} aria-hidden="true" />
        </span>
        <Avatar initials={person.initials} color={person.color} />
        <div className={styles.who}>
          <b>{person.name}</b>
          <small>{person.roleLabel}</small>
        </div>
      </div>
    </header>
  );
}
