import { useEffect, useRef, type ComponentType } from "react";
import { progressOf, type Step } from "../model/wizard";
import type { SignupWizardModel } from "./useSignupWizard";
import { CodeStep } from "./CodeStep";
import { ContactStep } from "./ContactStep";
import { DoneStep } from "./DoneStep";
import { LoginStep } from "./LoginStep";
import { ProfileStep } from "./ProfileStep";
import { ResetCodeStep, ResetContactStep } from "./ResetSteps";
import { ProgressBar } from "./ProgressBar";
import styles from "./wizard.module.css";

const steps: Record<Step, ComponentType<SignupWizardModel>> = {
  contact: ContactStep,
  code: CodeStep,
  profile: ProfileStep,
  done: DoneStep,
  login: LoginStep,
  resetContact: ResetContactStep,
  resetCode: ResetCodeStep,
};

const focusable = "button:not(:disabled), input, a[href]";

export function SignupWizard(model: SignupWizardModel) {
  const { step, busy } = model.state;
  const stepRef = useRef<HTMLDivElement>(null);
  const shownStep = useRef(step);

  useEffect(() => {
    if (shownStep.current === step) return;
    shownStep.current = step;
    const container = stepRef.current;
    const target =
      container?.querySelector<HTMLElement>("[data-autofocus]") ?? container?.querySelector<HTMLElement>(focusable);
    target?.focus();
  }, [step]);

  const StepView = steps[step];
  const progress = progressOf(step);
  return (
    <div className={styles.card} aria-live="polite" aria-busy={busy}>
      {progress !== null && <ProgressBar value={progress} />}
      <div ref={stepRef} className={styles.step}>
        <StepView {...model} />
      </div>
    </div>
  );
}
