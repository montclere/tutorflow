import { Backpack, Eye, Presentation, Users, X, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { env } from "../config/env";
import { routes } from "../config/routes";
import { landing } from "../content/landing.ru";
import { focusSignupStart, scrollToSignup } from "../features/signup/ui/signupStart";
import styles from "./RoleChooser.module.css";

/** Иконки ролей вместо эмодзи (VIBE-3). */
const roleIcons: Record<string, LucideIcon> = { teacher: Presentation, student: Backpack, parent: Users, browse: Eye };

const text = landing.roleChooser;
type Role = (typeof text.roles)[number]["id"];

const STORAGE_KEY = "tf-role-chooser-dismissed";
const APPEAR_MS = 4000;

function dismissed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function remember() {
  try {
    localStorage.setItem(STORAGE_KEY, "1");
  } catch {
    // Хранилище недоступно — вопрос просто покажется снова.
  }
}

/** «Как будете пользоваться?» — короткая подсказка под роль внизу справа, один раз (VIBE-3). */
export function RoleChooser() {
  const [visible, setVisible] = useState(false);
  const [role, setRole] = useState<Role | null>(null);

  useEffect(() => {
    if (dismissed()) return;
    const timer = setTimeout(() => setVisible(true), APPEAR_MS);
    return () => clearTimeout(timer);
  }, []);

  if (!visible) return null;

  const close = () => {
    remember();
    setVisible(false);
  };

  const act = (chosen: Role) => {
    close();
    if (chosen === "teacher") {
      scrollToSignup();
      requestAnimationFrame(focusSignupStart);
    } else if (chosen === "browse") {
      window.location.assign(env.demoUrl ?? routes.teacherCabinet);
    }
  };

  return (
    <aside className={styles.chooser} aria-label={text.question}>
      <button type="button" className={styles.close} aria-label={text.close} onClick={close}>
        <X size={14} aria-hidden="true" />
      </button>
      <p className={styles.bubble}>{role ? text.answers[role].text : text.question}</p>
      {role ? (
        <button type="button" className={styles.action} onClick={() => act(role)}>
          {text.answers[role].action}
        </button>
      ) : (
        <ul className={styles.roles}>
          {text.roles.map((item) => {
            const Icon = roleIcons[item.id] ?? Eye;
            return (
              <li key={item.id}>
                <button type="button" className={styles.role} onClick={() => setRole(item.id)}>
                  <Icon size={16} aria-hidden="true" />
                  {item.label}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
