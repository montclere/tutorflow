import { routes } from "../../../config/routes";
import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import type { SignupWizardModel } from "./useSignupWizard";
import styles from "./wizard.module.css";

const text = landing.wizard.done;

export function DoneStep({ state }: SignupWizardModel) {
  const firstName = state.name.trim().split(/\s+/)[0] ?? "";
  const firstSubject = state.subjects[0];
  const subject = firstSubject ? landing.wizard.profile.subjects[firstSubject].toLowerCase() : "";

  return (
    <>
      <div className={styles.doneMark} aria-hidden="true">
        {text.mark}
      </div>
      <h3 className={styles.title}>{text.title(firstName)}</h3>
      <p className={styles.hint}>{text.text(subject)}</p>
      <ol className={styles.checklist}>
        {text.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ol>
      <Button variant="primary" href={routes.teacherCabinet} className={styles.submit} data-autofocus>
        {text.go}
      </Button>
    </>
  );
}
