import { landing } from "../content/landing.ru";
import { SignupCta } from "../features/signup/ui/SignupCta";
import { SectionHeading } from "../shared/ui/SectionHeading";
import { Lines } from "../shared/ui/Lines";
import styles from "./Pricing.module.css";

const text = landing.pricing;

export function Pricing() {
  return (
    <section className={styles.section} id="pricing" aria-labelledby="pricing-title">
      <SectionHeading id="pricing-title" lines={[text.title]} subtitle={text.subtitle} />
      <div className={styles.plans}>
        {text.plans.map((plan) => (
          <article key={plan.id} className={`${styles.plan} ${styles[plan.id]}`}>
            {plan.seal && (
              <p className={styles.seal}>
                <Lines lines={plan.seal} />
              </p>
            )}
            <h3 className={styles.name}>{plan.name}</h3>
            <p className={styles.price}>
              {plan.price}
              {plan.period && <small>{plan.period}</small>}
            </p>
            <ul className={styles.features}>
              {plan.features.map((feature) => (
                <li key={feature}>
                  <span className={styles.mark} aria-hidden="true">
                    {text.featureMark}
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <SignupCta place="pricing" label={plan.cta} variant="plain" className={styles.cta} />
          </article>
        ))}
      </div>
    </section>
  );
}
