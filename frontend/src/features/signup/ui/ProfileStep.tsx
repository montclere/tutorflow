import { useId, useRef, type FormEvent } from "react";
import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import { NAME_MAX } from "../model/validation";
import type { SignupWizardModel } from "./useSignupWizard";
import { FieldError } from "./FieldError";
import { PasswordField } from "./PasswordField";
import styles from "./wizard.module.css";

const text = landing.wizard.profile;

/** Имя, пароль и часовой пояс — уходят на сервер вместе с кодом (SIGNUP-6). */
export function ProfileStep({ wizard, state }: SignupWizardModel) {
  const nameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const ids = { name: useId(), nameError: useId(), formError: useId() };
  const { profileErrors } = state;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors = await wizard.submitProfile();
    if (errors.name) nameRef.current?.focus();
    else if (errors.password) passwordRef.current?.focus();
  };

  return (
    <>
      <button type="button" className={styles.back} onClick={wizard.backToCode}>
        {text.back}
      </button>
      <h3 className={styles.title}>{text.title}</h3>
      <p className={styles.hint}>{wizard.invitation ? landing.wizard.invitation.profileHint : text.hint}</p>
      <form className={styles.form} noValidate onSubmit={submit}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.name}>
            {text.nameLabel}
          </label>
          <input
            ref={nameRef}
            id={ids.name}
            className={styles.input}
            autoComplete="name"
            maxLength={NAME_MAX}
            placeholder={text.namePlaceholder}
            value={state.name}
            onChange={(event) => wizard.setName(event.target.value)}
            aria-invalid={Boolean(profileErrors.name)}
            aria-describedby={ids.nameError}
            data-autofocus
          />
          <FieldError id={ids.nameError} message={profileErrors.name ? text[profileErrors.name] : null} />
        </div>
        <PasswordField
          inputRef={passwordRef}
          label={text.passwordLabel}
          hint={text.passwordHint}
          create
          value={state.password}
          onChange={wizard.setPassword}
          error={profileErrors.password ? text[profileErrors.password] : null}
        />
        <p className={styles.timezone}>
          {text.timezoneLabel} <b>{wizard.timezone?.label ?? text.timezoneUnknown}</b>
        </p>
        <FieldError id={ids.formError} message={state.error && landing.wizard.errors[state.error]} />
        <Button variant="primary" type="submit" className={styles.submit} disabled={state.busy}>
          {text.submit}
        </Button>
      </form>
    </>
  );
}
