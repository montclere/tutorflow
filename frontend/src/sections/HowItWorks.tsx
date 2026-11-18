import { useId, useRef, useState, type KeyboardEvent } from "react";
import { landing } from "../content/landing.ru";
import { keyToIndex } from "../shared/lib/cycle";
import { SectionHeading } from "../shared/ui/SectionHeading";
import styles from "./HowItWorks.module.css";

const text = landing.how;

export function HowItWorks() {
  const [active, setActive] = useState(0);
  const toggles = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target = keyToIndex(event.key, index, text.steps.length);
    if (target === null) return;
    event.preventDefault();
    toggles.current[target]?.focus();
  };

  return (
    <section className={styles.section} id="how" aria-labelledby="how-title">
      <SectionHeading id="how-title" lines={text.titleLines} />
      <ol className={styles.flow}>
        {text.steps.map((step, index) => {
          const open = index === active;
          const panelId = `${baseId}-step-${index}`;
          return (
            <li key={step.number} className={styles.step} data-open={open}>
              <h3 className={styles.heading}>
                <button
                  ref={(element) => {
                    toggles.current[index] = element;
                  }}
                  type="button"
                  className={styles.toggle}
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => onKeyDown(event, index)}
                >
                  <span className={styles.number} aria-hidden="true">
                    {step.number}
                  </span>
                  <span className={styles.names}>
                    <span className={styles.title}>{step.title}</span>
                    <span className={styles.short}>{step.short}</span>
                  </span>
                  <span className={styles.expandIcon} aria-hidden="true" />
                </button>
              </h3>
              <div id={panelId} className={styles.panel} hidden={!open}>
                <p className={styles.text}>{step.text}</p>
                <ul className={styles.scene}>
                  {step.scene.map((row) => (
                    <li key={row.label}>
                      <span>{row.label}</span>
                      <b className={row.tone && styles[row.tone]}>{row.value}</b>
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
