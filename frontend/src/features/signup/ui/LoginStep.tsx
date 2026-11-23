import { useId, type FormEvent } from "react";
import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import type { SignupWizardModel } from "./useSignupWizard";
import { FieldError } from "./FieldError";
import { ModeTabs } from "./ModeTabs";
import { PasswordField } from "./PasswordField";
import styles from "./wizard.module.css";

const text = landing.wizard.login;

/** Вход по логину (почта или телефон) и паролю (SIGNUP-7). */
export function LoginStep(model: SignupWizardModel) {
  const { wizard, state } = model;
  const contactId = useId();
  const errorId = useId();

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void wizard.submitLogin();
  };

  return (
    <>
      <ModeTabs {...model} />
      <h3 className={styles.title}>{text.title}</h3>
      <p className={styles.hint}>{text.hint}</p>
      {state.notice === "passwordReset" && (
        <p className={styles.notice} role="status">
          {text.passwordReset}
        </p>
      )}
      <form className={styles.form} noValidate onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={contactId}>
            {text.contactLabel}
          </label>
          <input
            id={contactId}
            className={styles.input}
            autoComplete="username"
            autoCapitalize="none"
            maxLength={320}
            placeholder={text.contactPlaceholder}
            value={state.contact}
            onChange={(event) => wizard.setContact(event.target.value)}
            aria-invalid={state.error === "invalidContact"}
            aria-describedby={errorId}
            data-autofocus
          />
        </div>
        <PasswordField label={text.passwordLabel} create={false} value={state.password} onChange={wizard.setPassword} />
        <FieldError id={errorId} message={state.error && landing.wizard.errors[state.error]} />
        <Button variant="primary" type="submit" className={styles.submit} disabled={state.busy}>
          {text.submit}
        </Button>
      </form>
      <button type="button" className={styles.textButton} onClick={wizard.startReset}>
        {text.forgot}
      </button>
    </>
  );
}
