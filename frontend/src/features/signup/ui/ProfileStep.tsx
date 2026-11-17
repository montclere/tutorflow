import { useId, useRef, type FormEvent } from "react";
import { landing } from "../../../content/landing.ru";
import { Button } from "../../../shared/ui/Button";
import { studentsRanges, subjectIds } from "../model/profile";
import type { SignupWizardModel } from "./useSignupWizard";
import { ChipGroup } from "./ChipGroup";
import { FieldError } from "./FieldError";
import styles from "./wizard.module.css";

const text = landing.wizard.profile;

export function ProfileStep({ wizard, state }: SignupWizardModel) {
  const nameRef = useRef<HTMLInputElement>(null);
  const subjectsRef = useRef<HTMLDivElement>(null);
  const ids = {
    name: useId(),
    nameError: useId(),
    subjects: useId(),
    subjectsError: useId(),
    students: useId(),
    formError: useId(),
  };
  const { profileErrors } = state;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const errors = await wizard.submitProfile();
    if (errors.name) nameRef.current?.focus();
    else if (errors.subjects) subjectsRef.current?.querySelector("button")?.focus();
  };

  return (
    <>
      <h3 className={styles.title}>{text.title}</h3>
      <p className={styles.hint}>{text.hint}</p>
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
            placeholder={text.namePlaceholder}
            value={state.name}
            onChange={(event) => wizard.setName(event.target.value)}
            aria-invalid={Boolean(profileErrors.name)}
            aria-describedby={ids.nameError}
            data-autofocus
          />
          <FieldError id={ids.nameError} message={profileErrors.name ? text[profileErrors.name] : null} />
        </div>
        <ChipGroup
          ref={subjectsRef}
          labelId={ids.subjects}
          label={text.subjectsLabel}
          options={subjectIds}
          labels={text.subjects}
          isSelected={(subject) => state.subjects.includes(subject)}
          onSelect={wizard.toggleSubject}
          describedBy={ids.subjectsError}
        />
        <FieldError
          id={ids.subjectsError}
          message={profileErrors.subjects ? text[profileErrors.subjects] : null}
        />
        <ChipGroup
          labelId={ids.students}
          label={text.studentsLabel}
          options={studentsRanges}
          labels={text.studentsRanges}
          isSelected={(range) => state.studentsRange === range}
          onSelect={wizard.selectStudentsRange}
        />
        <p className={styles.timezone}>
          {text.timezoneLabel} <b>{wizard.timezone?.label ?? text.timezoneUnknown}</b>
        </p>
        <FieldError id={ids.formError} message={state.error && landing.wizard.errors[state.error]} />
        <Button variant="primary" type="submit" className={styles.submit}>
          {text.submit}
        </Button>
      </form>
    </>
  );
}
