import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { cabinet } from "../content/cabinet.ru";
import styles from "./ui.module.css";

const TOAST_MS = 2600;
type Notifier = { notify: (text: string) => void; notifySoon: (label: string) => void };

const NotifyContext = createContext<Notifier>({ notify: () => undefined, notifySoon: () => undefined });

export function useNotifier() {
  return useContext(NotifyContext);
}

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const notify = useCallback((text: string) => {
    window.clearTimeout(timer.current);
    setMessage(text);
    timer.current = window.setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  const notifySoon = useCallback((label: string) => notify(cabinet.notify.soon(label)), [notify]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <NotifyContext.Provider value={{ notify, notifySoon }}>
      {children}
      <div className={styles.toastRegion} role="status" aria-live="polite">
        {message && <div className={styles.toast}>{message}</div>}
      </div>
    </NotifyContext.Provider>
  );
}
