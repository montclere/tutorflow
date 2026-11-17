import { useId, useRef } from "react";
import { landing } from "../../../content/landing.ru";
import type { SignupMethod } from "../../../shared/analytics/track";
import type { SignupWizardModel } from "./useSignupWizard";
import { GoogleIcon, MailIcon, TelegramIcon } from "./AuthIcons";
import { FieldError } from "./FieldError";
import { SIGNUP_START_ID } from "./signupStart";
import styles from "./wizard.module.css";

const text = landing.wizard.method;

export function MethodStep({ wizard, state }: SignupWizardModel) {
  const consentRef = useRef<HTMLInputElement>(null);
  const consentErrorId = useId();
  const noteId = useId();

  const choose = (method: SignupMethod) => {
    if (!wizard.chooseMethod(method)) consentRef.current?.focus();
  };

  const error = state.consentMissing ? text.consentMissing : state.error && landing.wizard.errors[state.error];

  return (
    <>
      <h3 className={styles.title}>{text.title}</h3>
      <p className={styles.hint}>{text.hint}</p>
      <div className={styles.auth}>
        <button
          id={SIGNUP_START_ID}
          type="button"
          className={`${styles.authButton} ${styles.telegram}`}
          onClick={() => choose("telegram")}
        >
          <TelegramIcon />
          {text.telegram}
          <span className={styles.recommended}>{text.telegramBadge}</span>
        </button>
        <button type="button" className={styles.authButton} onClick={() => choose("google")}>
          <GoogleIcon />
          {text.google}
        </button>
        <p className={styles.divider}>{text.divider}</p>
        <button type="button" className={styles.authButton} onClick={() => choose("email")}>
          <MailIcon />
          {text.email}
        </button>
      </div>
      <label className={styles.consent}>
        <input
          ref={consentRef}
          type="checkbox"
          checked={state.consent}
          onChange={(event) => wizard.setConsent(event.target.checked)}
          aria-invalid={state.consentMissing}
          aria-describedby={consentErrorId}
        />
        <span>
          {text.consent.before}
          <a href={text.consent.offer.href} target="_blank" rel="noreferrer">
            {text.consent.offer.label}
          </a>
          {text.consent.middle}
          <a href={text.consent.policy.href} target="_blank" rel="noreferrer">
            {text.consent.policy.label}
          </a>
        </span>
      </label>
      <FieldError id={consentErrorId} message={error || null} />
      <button
        type="button"
        className={styles.textButton}
        aria-expanded={state.studentNoteOpen}
        aria-controls={noteId}
        onClick={wizard.toggleStudentNote}
      >
        {text.studentToggle}
      </button>
      <p id={noteId} className={styles.note} hidden={!state.studentNoteOpen}>
        {text.studentNote}
      </p>
    </>
  );
}
