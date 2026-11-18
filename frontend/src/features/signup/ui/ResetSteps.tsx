import { useId, type FormEvent } from "react";
import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import type { SignupWizardModel } from "./useSignupWizard";
import { CodeInput } from "./CodeInput";
import { FieldError } from "./FieldError";
import { PasswordField } from "./PasswordField";
import { useSecondsLeft } from "./useSecondsLeft";
import styles from "./wizard.module.css";

const text = landing.wizard.reset;
const codeText = landing.wizard.code;

/** Восстановление пароля, шаг 1: логин, на который придёт код (SIGNUP-11). */
export function ResetContactStep({ wizard, state }: SignupWizardModel) {
  const contactId = useId();
  const errorId = useId();
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void wizard.submitResetContact();
  };
  return (
    <>
      <button type="button" className={styles.back} onClick={() => wizard.setMode("login")}>
        {text.back}
      </button>
      <h3 className={styles.title}>{text.title}</h3>
      <p className={styles.hint}>{text.hint}</p>
      <form className={styles.form} noValidate onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={contactId}>
            {landing.wizard.login.contactLabel}
          </label>
          <input
            id={contactId}
            className={styles.input}
            autoComplete="username"
            autoCapitalize="none"
            maxLength={320}
            placeholder={landing.wizard.login.contactPlaceholder}
            value={state.contact}
            onChange={(event) => wizard.setContact(event.target.value)}
            aria-invalid={state.error === "invalidContact"}
            aria-describedby={errorId}
            data-autofocus
          />
          <FieldError id={errorId} message={state.error && landing.wizard.errors[state.error]} />
        </div>
        <Button variant="primary" type="submit" className={styles.submit} disabled={state.busy}>
          {text.submit}
        </Button>
      </form>
    </>
  );
}

/** Восстановление пароля, шаг 2: код и новый пароль. */
export function ResetCodeStep({ wizard, state }: SignupWizardModel) {
  const titleId = useId();
  const errorId = useId();
  const secondsLeft = useSecondsLeft(state.resendAvailableAt);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    void wizard.submitReset();
  };
  return (
    <>
      <button type="button" className={styles.back} onClick={wizard.backToContact}>
        {codeText.back}
      </button>
      <h3 id={titleId} className={styles.title}>
        {text.codeTitle}
      </h3>
      <p className={styles.hint}>
        {text.codeHint} {state.codeResent && codeText.resent}
      </p>
      <form className={styles.form} noValidate onSubmit={submit}>
        <CodeInput digits={state.code} onChange={wizard.changeCode} labelledBy={titleId} describedBy={errorId} invalid={state.error === "invalidCode"} digitLabel={codeText.digitLabel} />
        <FieldError id={errorId} message={state.error && landing.wizard.errors[state.error]} />
        <PasswordField
          label={text.passwordLabel}
          hint={landing.wizard.profile.passwordHint}
          create
          value={state.password}
          onChange={wizard.setPassword}
          error={state.profileErrors.password ? landing.wizard.profile.passwordLength : null}
        />
        <Button variant="primary" type="submit" className={styles.submit} disabled={state.busy}>
          {text.save}
        </Button>
      </form>
      <button type="button" className={styles.textButton} disabled={secondsLeft > 0 || state.busy} aria-live="off" onClick={() => void wizard.resendCode()}>
        {secondsLeft > 0 ? codeText.resendIn(secondsLeft) : codeText.resend}
      </button>
    </>
  );
}
