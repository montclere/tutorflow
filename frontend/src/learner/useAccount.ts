import { useCallback, useEffect, useState } from "react";
import { authApi, AuthError, type Cabinets, type Profile } from "../features/auth/api";

export type Account = { profile: Profile; cabinets: Cabinets };
export type AccountState = { kind: "loading" } | { kind: "anonymous" } | { kind: "failed" } | { kind: "ready"; account: Account };

/** Кто вошёл и какие кабинеты ему доступны; без сессии — anonymous, а не ошибка. */
export function useAccount() {
  const [state, setState] = useState<AccountState>({ kind: "loading" });

  const load = useCallback(async () => {
    try {
      const [profile, cabinets] = await Promise.all([authApi.profile(), authApi.cabinets()]);
      setState({ kind: "ready", account: { profile, cabinets } });
    } catch (error) {
      setState(error instanceof AuthError && error.code === "unauthenticated" ? { kind: "anonymous" } : { kind: "failed" });
    }
  }, []);

  useEffect(() => {
    // Сессия — внешний источник; состояние выставляется после ответа сервера.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  return { state, reload: load };
}
