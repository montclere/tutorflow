import { useRef, useState, type KeyboardEvent } from "react";
import { landing } from "../content/landing.ru";
import { SectionHeading } from "../shared/ui/SectionHeading";
import styles from "./Faq.module.css";

const text = landing.faq;
const tabId = (id: string) => `faq-tab-${id}`;
const panelId = (id: string) => `faq-panel-${id}`;

export function Faq() {
  const [active, setActive] = useState(0);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const select = (index: number) => {
    const next = (index + text.tabs.length) % text.tabs.length;
    setActive(next);
    tabs.current[next]?.focus();
  };

  const onKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowRight: active + 1,
      ArrowLeft: active - 1,
      Home: 0,
      End: text.tabs.length - 1,
    };
    const target = moves[event.key];
    if (target === undefined) return;
    event.preventDefault();
    select(target);
  };

  return (
    <section className={styles.section} id="faq" aria-labelledby="faq-title">
      <SectionHeading id="faq-title" lines={[text.title]} />
      <div className={styles.tabs} role="tablist" aria-label={text.tabsLabel}>
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
          </button>
        ))}
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
              <summary className={styles.question}>{item.question}</summary>
              <p className={styles.answer}>{item.answer}</p>
            </details>
          ))}
        </div>
      ))}
    </section>
  );
}
