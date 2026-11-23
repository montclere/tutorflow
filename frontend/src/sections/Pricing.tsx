import { Check, Sparkles, Sprout } from "lucide-react";
import { landing } from "../content/landing.ru";
import { SignupCta } from "../features/signup/ui/SignupCta";
import { Lines } from "../shared/ui/Lines";
import { SectionHeading } from "../shared/ui/SectionHeading";
import styles from "./Pricing.module.css";

const text = landing.pricing;

export function Pricing() {
  return (
    <section className={styles.section} id="pricing" aria-labelledby="pricing-title">
      <SectionHeading id="pricing-title" lines={[text.title]} />
      <div className={styles.plans}>
        {text.plans.map((plan) => {
          const Icon = plan.id === "pro" ? Sparkles : Sprout;
          return (
            <article key={plan.id} className={`${styles.plan} ${styles[plan.id]}`}>
              {plan.seal && (
                <p className={styles.seal}>
                  <Lines lines={plan.seal} />
                </p>
              )}
              <header className={styles.head}>
                <span className={styles.icon} aria-hidden="true">
                  <Icon size={24} />
                </span>
                <h3 className={styles.name}>{plan.name}</h3>
              </header>

              <div className={styles.priceBox}>
                <p className={styles.price}>
                  {plan.price}
                  {plan.period && <small>{plan.period}</small>}
                </p>
                <p className={styles.priceNote}>{plan.priceNote}</p>
              </div>

              <p className={styles.featuresTitle}>{plan.featuresTitle}</p>
              <ul className={styles.features}>
                {plan.features.map((feature) => (
                  <li key={feature.title}>
                    <span className={styles.mark} aria-hidden="true">
                      <Check size={14} strokeWidth={3} />
                    </span>
                    <span>
                      <b className={styles.featureTitle}>{feature.title}</b>
                      <span className={styles.featureText}>{feature.text}</span>
                    </span>
                  </li>
                ))}
              </ul>

              <SignupCta place="pricing" label={plan.cta} variant="plain" className={styles.cta} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
