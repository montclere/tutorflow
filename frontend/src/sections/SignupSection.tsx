import { useEffect, useRef } from "react";
import { landing } from "../content/landing.ru";
import { SIGNUP_SECTION_ID } from "../features/signup/ui/signupStart";
import { SignupWizard } from "../features/signup/ui/SignupWizard";
import type { SignupWizardModel } from "../features/signup/ui/useSignupWizard";
import { track } from "../shared/analytics/track";
import { Object3D } from "../shared/decor/Object3D";
import { Tag } from "../shared/ui/Tag";
import styles from "./SignupSection.module.css";

const text = landing.signup;

function useViewTracking() {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        track("signup_view");
        observer.disconnect();
      },
      { threshold: 0.4 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}

export function SignupSection(wizard: SignupWizardModel) {
  const ref = useViewTracking();
  return (
    <section ref={ref} className={styles.signup} id={SIGNUP_SECTION_ID} aria-labelledby="signup-title">
      <div className={styles.pitch}>
        <Tag>{text.tag}</Tag>
        <h2 id="signup-title" className={styles.title}>
          {text.title}
        </h2>
        <ul className={styles.perks}>
          {text.perks.map((perk) => (
            <li key={perk}>
              <span className={styles.mark} aria-hidden="true">
                {text.perkMark}
              </span>
              {perk}
            </li>
          ))}
        </ul>
      </div>
      <Object3D name="coins-stack" className={styles.coins} />
      <SignupWizard {...wizard} />
    </section>
  );
}
