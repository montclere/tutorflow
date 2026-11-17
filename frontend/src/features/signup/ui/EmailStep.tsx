import { useId, type FormEvent } from "react";
import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import type { SignupWizardModel } from "./useSignupWizard";
import { FieldError } from "./FieldError";
import styles from "./wizard.module.css";

const text = landing.wizard.email;

export function EmailStep({ wizard, state }: SignupWizardModel) {
  const inputId = useId();
  const errorId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void wizard.submitEmail();
  };

  return (
    <>
      <button type="button" className={styles.back} onClick={wizard.backToMethod}>
        {text.back}
      </button>
      <h3 className={styles.title}>{text.title}</h3>
      <p className={styles.hint}>{text.hint}</p>
      <form className={styles.form} noValidate onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={inputId}>
            {text.label}
          </label>
          <input
            id={inputId}
            className={styles.input}
            type="email"
            autoComplete="email"
            placeholder={text.placeholder}
            value={state.email}
            onChange={(event) => wizard.setEmail(event.target.value)}
            aria-invalid={state.error === "invalidEmail"}
            aria-describedby={errorId}
            data-autofocus
          />
        </div>
        <FieldError id={errorId} message={state.error && landing.wizard.errors[state.error]} />
        <Button variant="primary" type="submit" className={styles.submit}>
          {text.submit}
        </Button>
      </form>
    </>
  );
}
