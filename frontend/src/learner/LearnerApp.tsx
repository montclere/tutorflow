import { useEffect } from "react";
import { routes } from "../config/routes";
import { LOGIN_HASH } from "../features/signup/ui/signupStart";
import { InvitePage, ParentInvitePage } from "./InvitePage";
import { LearnerFrame, Panel } from "./LearnerFrame";
import { learner } from "./learner.ru";
import { MyCardsPage } from "./MyCardsPage";
import { useAccount } from "./useAccount";
import { Button } from "../cabinet/ui/Button";
import { NotificationsProvider } from "../cabinet/ui/Notifications";

type Page = "invite" | "parentInvite" | "student" | "parent";

/** Страницы рабочей сборки для ученика и родителя; в демо их нет — там кабинет ученика на тестовых данных. */
export function learnerPageOf(pathname: string): Page | null {
  if (pathname === routes.invite) return "invite";
  if (pathname === routes.parentInvite) return "parentInvite";
  if (pathname === routes.studentCabinet || pathname.startsWith(`${routes.studentCabinet}/`)) return "student";
  if (pathname === routes.parentCabinet) return "parent";
  return null;
}

export function LearnerApp({ pathname, page }: { pathname: string; page: Page }) {
  const { state, reload } = useAccount();
  const cabinetPage = page === "student" || page === "parent";

  useEffect(() => {
    // Кабинету нужна сессия: без неё — на форму входа, как у кабинета репетитора.
    if (cabinetPage && state.kind === "anonymous") window.location.assign(`${routes.home}${LOGIN_HASH}`);
  }, [cabinetPage, state.kind]);

  useEffect(() => {
    const previous = document.title;
    document.title = "TutorFlow";
    return () => {
      document.title = previous;
    };
  }, []);

  const account = state.kind === "ready" ? state.account : null;

  const content = () => {
    if (page === "invite") return <InvitePage account={state} reload={reload} />;
    if (page === "parentInvite") return <ParentInvitePage account={state} reload={reload} />;
    if (state.kind === "failed") {
      return (
        <Panel>
          <p className="m-0 text-base font-semibold" role="alert">
            {learner.failed}
          </p>
          <span>
            <Button onClick={() => void reload()}>{learner.retry}</Button>
          </span>
        </Panel>
      );
    }
    if (state.kind !== "ready") {
      return (
        <p className="m-0 py-10 text-center text-sm font-bold text-muted-foreground" role="status">
          {learner.loading}
        </p>
      );
    }
    return <MyCardsPage role={page} timezone={state.account.profile.timezone} />;
  };

  return (
    <NotificationsProvider>
      <LearnerFrame account={account} pathname={pathname}>
        {content()}
      </LearnerFrame>
    </NotificationsProvider>
  );
}
