import { landing } from "../../../content/landing.ru";
import type { SignupWizardModel } from "./useSignupWizard";
import styles from "./wizard.module.css";

const text = landing.wizard.tabs;

/** «Регистрация / Вход» — над первыми шагами, пока пользователь не начал вводить код. */
export function ModeTabs({ wizard, state }: SignupWizardModel) {
  return (
    <div className={styles.tabs} role="group" aria-label={text.label}>
      <button type="button" className={styles.tab} aria-pressed={state.mode === "register"} onClick={() => wizard.setMode("register")}>
        {text.register}
      </button>
      <button type="button" className={styles.tab} aria-pressed={state.mode !== "register"} onClick={() => wizard.setMode("login")}>
        {text.login}
      </button>
    </div>
  );
}
