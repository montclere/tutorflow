import { type FormEvent } from "react";
import { studentPerson, teacherPerson } from "../mocks/people";
import { cabinet, type Role } from "../content/cabinet.ru";
import { Avatar } from "../ui/Avatar";
import { cx } from "../ui/cx";
import { useNotifier } from "../ui/Notifications";
import styles from "./layout.module.css";

type Props = { role: Role; menuOpen: boolean; onToggleMenu: () => void };

export function Topbar({ role, menuOpen, onToggleMenu }: Props) {
  const { notifySoon } = useNotifier();
  const person = role === "teacher" ? teacherPerson : studentPerson;

  const search = (event: FormEvent) => {
    event.preventDefault();
    notifySoon(cabinet.shell.searchLabel);
  };

  return (
    <header className={styles.top}>
      <div className={styles.topLeft}>
        <button
          type="button"
          className={cx(styles.iconBtn, styles.burger)}
          aria-label={menuOpen ? cabinet.shell.closeMenu : cabinet.shell.openMenu}
          aria-expanded={menuOpen}
          aria-controls="cabinet-menu"
          onClick={onToggleMenu}
        >
          ☰
        </button>
        <form className={styles.search} role="search" onSubmit={search}>
          <span aria-hidden="true">⌕</span>
          <input placeholder={cabinet.shell.searchPlaceholder} aria-label={cabinet.shell.searchLabel} />
        </form>
      </div>
      <div className={styles.me}>
        <button type="button" className={styles.iconBtn} aria-label={cabinet.shell.notificationsLabel} onClick={() => notifySoon(cabinet.shell.notificationsLabel)}>
          🔔<i className={styles.dot} />
        </button>
        <Avatar initials={person.initials} tone={person.tone} />
        <div className={styles.who}>
          <b>{person.name}</b>
          <small>{person.roleLabel}</small>
        </div>
      </div>
    </header>
  );
}
