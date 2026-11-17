import { landing } from "../content/landing.ru";
import { SectionHeading } from "../shared/ui/SectionHeading";
import styles from "./HowItWorks.module.css";

const text = landing.how;

export function HowItWorks() {
  return (
    <section className={styles.section} id="how" aria-labelledby="how-title">
      <SectionHeading id="how-title" lines={text.titleLines} subtitle={text.subtitle} />
      <ol className={styles.flow}>
        {text.steps.map((step) => (
          <li key={step.number} className={styles.step}>
            <span className={styles.number} aria-hidden="true">
              {step.number}
            </span>
            <h3 className={styles.title}>{step.title}</h3>
            <p className={styles.text}>{step.text}</p>
            <div className={styles.demo}>
              {step.chips.map((chip) => (
                <span
                  key={chip.label}
                  className={[styles.chip, styles[chip.tone], chip.trend && styles[chip.trend]]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {chip.label}
                </span>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
