import { useId } from "react";
import { landing } from "../../../content/landing.ru";
import type { SignupWizardModel } from "./useSignupWizard";
import { CodeInput } from "./CodeInput";
import { FieldError } from "./FieldError";
import { useSecondsLeft } from "./useSecondsLeft";
import styles from "./wizard.module.css";

const text = landing.wizard.code;

export function CodeStep({ wizard, state }: SignupWizardModel) {
  const titleId = useId();
  const errorId = useId();
  const secondsLeft = useSecondsLeft(state.resendAvailableAt);

  return (
    <>
      <button type="button" className={styles.back} onClick={wizard.backToEmail}>
        {text.back}
      </button>
      <h3 id={titleId} className={styles.title}>
        {text.title}
      </h3>
      <p className={styles.hint}>
        {text.hint(state.email.trim())} {state.codeResent && text.resent}
      </p>
      <CodeInput
        digits={state.code}
        onChange={wizard.changeCode}
        labelledBy={titleId}
        describedBy={errorId}
        invalid={state.error !== null}
        digitLabel={text.digitLabel}
      />
      <FieldError id={errorId} message={state.error && landing.wizard.errors[state.error]} />
      <button
        type="button"
        className={styles.textButton}
        disabled={secondsLeft > 0}
        aria-live="off"
        onClick={() => void wizard.resendCode()}
      >
        {secondsLeft > 0 ? text.resendIn(secondsLeft) : text.resend}
      </button>
    </>
  );
}
