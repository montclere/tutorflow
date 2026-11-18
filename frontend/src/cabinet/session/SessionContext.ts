import { createContext, useContext } from "react";

export type CabinetSession = {
  /** Демо-сборка: тестовые данные, без сервера (VITE_DEMO=1). */
  demo: boolean;
  displayName: string;
  timezone: string;
  logout: () => void;
};

export const SessionContext = createContext<CabinetSession | null>(null);

export function useSession(): CabinetSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession вне SessionGate");
  return session;
}
