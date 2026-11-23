import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import type { SignupWizardModel } from "./useSignupWizard";
import { FieldError } from "./FieldError";
import styles from "./wizard.module.css";

const text = landing.wizard.done;

/** Аккаунт создан или вошли без кабинета: кабинет репетитора включается явной кнопкой (IDN-15). */
export function DoneStep({ wizard, state }: SignupWizardModel) {
  const firstName = state.name.trim().split(/\s+/)[0] ?? "";
  return (
    <>
      <div className={styles.doneMark} aria-hidden="true">
        {text.mark}
      </div>
      <h3 className={styles.title}>{text.title(firstName)}</h3>
      <p className={styles.hint}>{text.text}</p>
      <ol className={styles.checklist}>
        {text.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <FieldError id="signup-done-error" message={state.error && landing.wizard.errors[state.error]} />
      <Button variant="primary" className={styles.submit} disabled={state.busy} onClick={() => void wizard.enterCabinet()} data-autofocus>
        {text.go}
      </Button>
    </>
  );
}
