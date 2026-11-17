import { siteConfig } from "../../config/site";
import { cabinet, type Role } from "../content/cabinet.ru";
import { CabinetLink } from "../ui/CabinetLink";
import { cx } from "../ui/cx";
import { Icon } from "../ui/Icon";
import { navigate } from "../../app/router";
import { routes } from "../../config/routes";
import styles from "./layout.module.css";

type Props = { role: Role; pathname: string; open: boolean; onClose: () => void };

function isActive(pathname: string, path: string, prefix?: string) {
  return prefix ? pathname.startsWith(prefix) : pathname === path;
}

export function Sidebar({ role, pathname, open, onClose }: Props) {
  const promo = cabinet.promo[role];

  return (
    <aside id="cabinet-menu" className={cx(styles.side, open && styles.sideOpen)} aria-label={cabinet.shell.menuLabel}>
      <CabinetLink className={styles.logo} href={routes.home} aria-label={cabinet.shell.homeLabel}>
        <span className={styles.logoLeft}>{siteConfig.logo.left}</span>
        <span className={styles.logoRight}>{siteConfig.logo.right}</span>
      </CabinetLink>

      <div className={styles.roles} role="group" aria-label={cabinet.shell.roleGroupLabel}>
        {cabinet.roles.map((item) => (
          <button key={item.id} type="button" aria-pressed={item.id === role} onClick={() => navigate(item.path)}>
            {item.label}
          </button>
        ))}
      </div>

      <nav className={styles.nav} aria-label={cabinet.shell.menuLabel}>
        {cabinet.nav[role].map((item) => (
          <CabinetLink
            key={item.path}
            href={item.path}
            aria-current={isActive(pathname, item.path, item.matchPrefix) ? "page" : undefined}
            onClick={onClose}
          >
            <Icon name={item.icon} />
            {item.label}
            {item.badge && <span className={styles.count}>{item.badge}</span>}
          </CabinetLink>
        ))}
      </nav>

      <div className={styles.promo}>
        <b>{promo.title}</b>
        {promo.text}
      </div>
    </aside>
  );
}
