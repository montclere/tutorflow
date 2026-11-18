import { useRef, useState, type KeyboardEvent } from "react";
import { landing } from "../content/landing.ru";
import { keyToIndex } from "../shared/lib/cycle";
import styles from "./Faq.module.css";

const text = landing.faq;
const tabId = (id: string) => `faq-tab-${id}`;
const panelId = (id: string) => `faq-panel-${id}`;

export function Faq() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const onKeyDown = (event: KeyboardEvent) => {
    const target = keyToIndex(event.key, active, text.tabs.length);
    if (target === null) return;
    event.preventDefault();
    setActive(target);
    tabs.current[target]?.focus();
  };

  return (
    <section className={styles.section} id="faq" aria-labelledby="faq-title">
      <div className={styles.aside}>
        <div className={styles.sticky}>
          <h2 id="faq-title" className={styles.title}>
            {text.title}
          </h2>
          <div className={styles.tabs} role="tablist" aria-label={text.tabsLabel} aria-orientation="vertical">
            {text.tabs.map((tab, index) => (
              <button
                key={tab.id}
                ref={(element) => {
                  tabs.current[index] = element;
                }}
                id={tabId(tab.id)}
                className={styles.tab}
                type="button"
                role="tab"
                aria-selected={index === active}
                aria-controls={panelId(tab.id)}
                tabIndex={index === active ? 0 : -1}
                onClick={() => setActive(index)}
                onKeyDown={onKeyDown}
              >
                {tab.label}
                <span className={styles.count} aria-hidden="true">
                  {tab.items.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>
      {text.tabs.map((tab, index) => (
        <div
          key={tab.id}
          id={panelId(tab.id)}
          className={styles.list}
          role="tabpanel"
          aria-labelledby={tabId(tab.id)}
          hidden={index !== active}
        >
          {tab.items.map((item, itemIndex) => (
            <details key={item.question} className={styles.item} open={itemIndex === 0}>
              <summary className={styles.question}>
                <span className={styles.number} aria-hidden="true">
                  {String(itemIndex + 1).padStart(2, "0")}
                </span>
                <span className={styles.questionText}>{item.question}</span>
                <span className={styles.icon} aria-hidden="true" />
              </summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      ))}
    </section>
  );
}
