import { useCallback, useEffect, useState, type ReactNode } from "react";
import { env } from "../../config/env";
import { routes } from "../../config/routes";
import { authApi, AuthError, type Profile } from "../../features/auth/api";
import { LOGIN_HASH } from "../../features/signup/ui/signupStart";
import { cabinet } from "../content/cabinet.ru";
import { teacherPerson } from "../mocks/people";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { SessionContext, type CabinetSession } from "./SessionContext";

const text = cabinet.session;

type State = { kind: "loading" } | { kind: "failed" } | { kind: "noTeacher"; profile: Profile } | { kind: "ready"; profile: Profile };

const toLogin = () => window.location.assign(`${routes.home}${LOGIN_HASH}`);

async function logout() {
  try {
    await authApi.logout();
  } finally {
    window.location.assign(routes.home);
  }
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="grid min-h-screen place-items-center bg-background p-6">{children}</div>;
}

/**
 * Рабочая сборка: кабинет только с сессией и включённым кабинетом репетитора (WEB-1, IDN-15);
 * без сессии — на форму входа. Демо-сборка открывается сразу с тестовым профилем.
 */
export function SessionGate({ children }: { children: ReactNode }) {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const [profile, cabinets] = await Promise.all([authApi.profile(), authApi.cabinets()]);
      setState(cabinets.teacherEnabled ? { kind: "ready", profile } : { kind: "noTeacher", profile });
    } catch (error) {
      if (error instanceof AuthError && error.code === "unauthenticated") toLogin();
      else setState({ kind: "failed" });
    }
  }, []);

  useEffect(() => {
    if (env.demo) return;
    // Загрузка сессии — внешний источник; состояние выставляется после ответа сервера.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (env.demo) {
    const session: CabinetSession = { demo: true, displayName: teacherPerson.name, timezone: "Asia/Novosibirsk", logout: () => window.location.assign(routes.home) };
    return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
  }

  if (state.kind === "loading") {
    return (
      <Centered>
        <p className="m-0 text-sm font-bold text-muted-foreground" role="status">
          {text.loading}
        </p>
      </Centered>
    );
  }
  if (state.kind === "failed") {
    return (
      <Centered>
        <EmptyState emoji="😕" title={text.failed} action={<Button onClick={() => void load()}>{text.retry}</Button>} />
      </Centered>
    );
  }
  if (state.kind === "noTeacher") {
    const enable = async () => {
      try {
        await authApi.enableTeacherCabinet();
        setState({ kind: "ready", profile: state.profile });
      } catch {
        setState({ kind: "failed" });
      }
    };
    return (
      <Centered>
        <EmptyState
          title={text.enableTitle}
          text={text.enableText}
          action={
            <Button variant="primary" onClick={() => void enable()}>
              {text.enable}
            </Button>
          }
        />
      </Centered>
    );
  }

  const session: CabinetSession = { demo: false, displayName: state.profile.displayName, timezone: state.profile.timezone, logout: () => void logout() };
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}
