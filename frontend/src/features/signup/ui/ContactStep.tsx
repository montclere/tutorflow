import { useId, useRef, type FormEvent } from "react";
import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import type { ContactType } from "../../auth/api";
import type { SignupWizardModel } from "./useSignupWizard";
import { FieldError } from "./FieldError";
import { ModeTabs } from "./ModeTabs";
import { SIGNUP_START_ID } from "./signupStart";
import styles from "./wizard.module.css";

const text = landing.wizard.contact;
const types: ContactType[] = ["email", "phone"];

/** Первый шаг регистрации: почта или телефон и согласие с офертой (SIGNUP-1, SIGNUP-2). */
export function ContactStep(model: SignupWizardModel) {
  const { wizard, state } = model;
  const consentRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const typeLabelId = useId();
  const errorId = useId();
  const consentErrorId = useId();
  const noteId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await wizard.submitContact();
    if (wizard.getState().consentMissing) consentRef.current?.focus();
  };

  return (
    <>
      <ModeTabs {...model} />
      <h3 className={styles.title}>{text.title}</h3>
      <p className={styles.hint}>{text.hint}</p>
      <form className={styles.form} noValidate onSubmit={submit}>
        <div className={styles.field}>
          <span id={typeLabelId} className={styles.label}>
            {text.typeLabel}
          </span>
          <div className={styles.chips} role="group" aria-labelledby={typeLabelId}>
            {types.map((type) => (
              <button key={type} type="button" className={styles.chip} aria-pressed={state.contactType === type} onClick={() => wizard.setContactType(type)}>
                {text.types[type]}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={inputId}>
            {text.labels[state.contactType]}
          </label>
          <input
            id={inputId}
            className={styles.input}
            type={state.contactType === "email" ? "email" : "tel"}
            inputMode={state.contactType === "email" ? "email" : "tel"}
            autoComplete={state.contactType === "email" ? "email" : "tel"}
            maxLength={320}
            placeholder={text.placeholders[state.contactType]}
            value={state.contact}
            onChange={(event) => wizard.setContact(event.target.value)}
            aria-invalid={state.error === "invalidContact"}
            aria-describedby={errorId}
            data-autofocus
          />
          <FieldError id={errorId} message={state.error && landing.wizard.errors[state.error]} />
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
        <FieldError id={consentErrorId} message={state.consentMissing ? text.consentMissing : null} />
        <Button id={SIGNUP_START_ID} variant="primary" type="submit" className={styles.submit} disabled={state.busy}>
          {text.submit}
        </Button>
      </form>
      <button type="button" className={styles.textButton} aria-expanded={state.studentNoteOpen} aria-controls={noteId} onClick={wizard.toggleStudentNote}>
        {text.studentToggle}
      </button>
      <p id={noteId} className={styles.note} hidden={!state.studentNoteOpen}>
        {text.studentNote}
      </p>
    </>
  );
}
