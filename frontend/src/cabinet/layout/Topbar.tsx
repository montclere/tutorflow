import { Check, ChevronDown, Crown, Globe, GraduationCap, LayoutGrid, LifeBuoy, LogOut, Menu, Presentation } from "lucide-react";
import { navigate } from "../../app/router";
import { env } from "../../config/env";
import { routes } from "../../config/routes";
import { siteConfig } from "../../config/site";
import { cabinet, type Role } from "../content/cabinet.ru";
import { studentPerson, teacherPerson } from "../mocks/people";
import { initialsOf } from "../model/newStudent";
import { useSession } from "../session/SessionContext";
import { Avatar } from "../ui/Avatar";
import { CabinetLink } from "../ui/CabinetLink";
import { IconButton } from "../ui/Button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/shared/ui/kit/dropdown-menu";
import styles from "./layout.module.css";

const text = cabinet.shell;
const roleIcons = { teacher: Presentation, student: GraduationCap } as const;
const itemClass = "gap-2.5 rounded-lg px-2.5 py-2 text-sm font-bold";

type Props = { role: Role; menuOpen: boolean; onToggleMenu: () => void };

/**
 * Верхняя панель на всю ширину (VIBE-12): слева логотип и меню кабинетов, справа «Помощь»,
 * плашка тарифа (в демо у репетитора) и аватар с меню аккаунта — имя, роль, «Выйти».
 */
export function Topbar({ role, menuOpen, onToggleMenu }: Props) {
  const session = useSession();
  // В рабочей сборке репетитор — вошедший пользователь; ученик в шапке бывает только в демо.
  const person =
    role === "teacher" && !session.demo
      ? { name: session.displayName, initials: initialsOf(session.displayName), color: teacherPerson.color, roleLabel: text.teacherRole }
      : role === "teacher"
        ? teacherPerson
        : studentPerson;
  const help = env.supportUrl ?? `${routes.home}#faq`;

  return (
    <header className={styles.top}>
      <div className={styles.topLeft}>
        <IconButton
          icon={Menu}
          label={menuOpen ? text.closeMenu : text.openMenu}
          className={styles.burger}
          aria-expanded={menuOpen}
          aria-controls="cabinet-menu"
          onClick={onToggleMenu}
        />
        <CabinetLink className={styles.logo} href={routes.home} aria-label={text.homeLabel}>
          <span className={styles.logoLeft}>{siteConfig.logo.left}</span>
          <span className={styles.logoRight}>{siteConfig.logo.right}</span>
        </CabinetLink>
        <span className={styles.divider} aria-hidden="true" />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={styles.apps} aria-label={text.apps}>
              <LayoutGrid size={20} aria-hidden="true" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" sideOffset={8} className="w-60 rounded-xl p-1.5">
            <DropdownMenuLabel className="px-2.5 text-xs font-bold text-muted-foreground">{text.apps}</DropdownMenuLabel>
            {/* Второй кабинет — только в демо: в рабочей сборке кабинет ученика открывается из приглашения. */}
            {env.demo &&
              cabinet.roles.map((item) => {
                const Icon = roleIcons[item.id];
                return (
                  <DropdownMenuItem key={item.id} className={itemClass} onSelect={() => navigate(item.path)}>
                    <Icon size={18} aria-hidden="true" />
                    {item.title}
                    {item.id === role && <Check size={16} className="ml-auto text-primary" aria-label="открыт" />}
                  </DropdownMenuItem>
                );
              })}
            {env.demo && <DropdownMenuSeparator />}
            <DropdownMenuItem className={itemClass} onSelect={() => navigate(routes.home)}>
              <Globe size={18} aria-hidden="true" />
              {text.site}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className={styles.me}>
        <a className={styles.help} href={help} aria-label={text.help} {...(env.supportUrl ? { target: "_blank", rel: "noreferrer" } : {})}>
          <LifeBuoy size={22} aria-hidden="true" />
          <span>{text.help}</span>
        </a>
        {session.demo && role === "teacher" && (
          <span className={styles.plan} title={text.planLabel} aria-label={text.planLabel}>
            <Crown size={18} aria-hidden="true" />
            {text.plan}
          </span>
        )}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" className={styles.account} aria-label={text.account(person.name)}>
              <ChevronDown size={18} className={styles.chevron} aria-hidden="true" />
              <span className={styles.avatarRing}>
                <Avatar initials={person.initials} color={person.color} />
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" sideOffset={8} className="w-60 rounded-xl p-1.5">
            <DropdownMenuLabel className="grid gap-0.5 px-2.5 py-2">
              <b className="text-sm font-extrabold">{person.name}</b>
              <span className="text-xs font-semibold text-muted-foreground">{person.roleLabel}</span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem className={itemClass} onSelect={session.logout}>
              <LogOut size={18} aria-hidden="true" />
              {text.logout}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
