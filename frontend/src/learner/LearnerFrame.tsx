import { LogOut } from "lucide-react";
import type { ReactNode } from "react";
import { routes } from "../config/routes";
import { siteConfig } from "../config/site";
import { authApi } from "../features/auth/api";
import { Button } from "../cabinet/ui/Button";
import { CabinetLink } from "../cabinet/ui/CabinetLink";
import { cx } from "../cabinet/ui/cx";
import layout from "../cabinet/layout/layout.module.css";
import { learner } from "./learner.ru";
import type { Account } from "./useAccount";

async function logout() {
  try {
    await authApi.logout();
  } finally {
    window.location.assign(routes.home);
  }
}

function CabinetNav({ account, pathname }: { account: Account; pathname: string }) {
  const { cabinets } = account;
  const items = [
    { href: routes.teacherCabinet, label: learner.nav.teacher, show: cabinets.teacherEnabled },
    { href: routes.studentCabinet, label: learner.nav.student, show: cabinets.studentAvailable || pathname.startsWith(routes.studentCabinet) },
    { href: routes.parentCabinet, label: learner.nav.parent, show: cabinets.parentAvailable || pathname.startsWith(routes.parentCabinet) },
  ].filter((item) => item.show);
  if (items.length === 0) return null;
  return (
    <nav aria-label={learner.nav.label} className="flex gap-1 rounded-xl bg-secondary p-1">
      {items.map((item) => {
        const current = pathname.startsWith(item.href);
        return (
          <CabinetLink
            key={item.href}
            href={item.href}
            aria-current={current ? "page" : undefined}
            className={cx(
              "rounded-lg px-3 py-1.5 text-sm font-bold no-underline transition-colors",
              current ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </CabinetLink>
        );
      })}
    </nav>
  );
}

/** Рамка страниц приглашений и кабинетов ученика и родителя: логотип, кабинеты, имя и выход. */
export function LearnerFrame({ account, pathname, children }: { account: Account | null; pathname: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 px-4 py-4">
        <CabinetLink className={layout.logo} href={routes.home} aria-label={learner.homeLabel}>
          <span className={layout.logoLeft}>{siteConfig.logo.left}</span>
          <span className={layout.logoRight}>{siteConfig.logo.right}</span>
        </CabinetLink>
        {account && (
          <div className="flex flex-wrap items-center gap-3">
            <CabinetNav account={account} pathname={pathname} />
            <span className="text-sm font-bold">{account.profile.displayName}</span>
            <Button icon={LogOut} onClick={() => void logout()}>
              {learner.logout}
            </Button>
          </div>
        )}
      </header>
      <main className="mx-auto grid max-w-3xl gap-5 px-4 pt-2 pb-16">{children}</main>
    </div>
  );
}

export function Heading({ title, text }: { title: string; text?: string }) {
  return (
    <div className="grid gap-2">
      <h1 className="m-0 font-[family-name:var(--font-display)] text-3xl leading-tight font-black tracking-tight text-balance max-[520px]:text-2xl">{title}</h1>
      {text && <p className="m-0 max-w-xl text-base font-semibold text-muted-foreground">{text}</p>}
    </div>
  );
}

export function Panel({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cx("grid gap-4 rounded-2xl border bg-card p-5 sm:p-6", className)}>{children}</section>;
}
