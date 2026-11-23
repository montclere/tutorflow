import { useId, useRef, useState, type KeyboardEvent } from "react";
import { env } from "../config/env";
import { landing } from "../content/landing.ru";
import { keyToIndex } from "../shared/lib/cycle";
import { SectionHeading } from "../shared/ui/SectionHeading";
import { PaymentTile, ReportTile } from "./FeatureTiles";
import styles from "./Features.module.css";

const text = landing.features;
const SHOT = { width: 1522, height: 975 };

export function Features() {
  const [active, setActive] = useState(0);
  const toggles = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  const onKeyDown = (event: KeyboardEvent, index: number) => {
    const target = keyToIndex(event.key, index, text.items.length);
    if (target === null) return;
    event.preventDefault();
    toggles.current[target]?.focus();
  };

  return (
    <section className={styles.section} id="features" aria-labelledby="features-title">
      <SectionHeading id="features-title" lines={text.titleLines} />
      <div className={styles.showcase}>
        <ul className={styles.list} aria-label={text.listLabel}>
          {text.items.map((item, index) => {
            const open = index === active;
            const panelId = `${baseId}-feature-${item.id}`;
            return (
              <li key={item.id} className={styles.item} data-open={open}>
                <h3 className={styles.itemHeading}>
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
                    <span className={styles.index} aria-hidden="true">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    {item.title}
                  </button>
                </h3>
                <div id={panelId} className={styles.panel} hidden={!open}>
                  <p className={styles.text}>{item.text}</p>
                  <ul className={styles.points}>
                    {item.points.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                  <a className={styles.demoLink} href={env.demoUrl ?? item.href}>
                    {text.demoLink} <span aria-hidden="true">→</span>
                  </a>
                  {/* На узком экране витрины справа нет — экран показываем прямо под описанием. */}
                  <img
                    className={styles.inlineShot}
                    src={item.image}
                    width={SHOT.width}
                    height={SHOT.height}
                    alt={item.imageAlt}
                    loading="lazy"
                    decoding="async"
                  />
                </div>
              </li>
            );
          })}
        </ul>
        <div className={styles.stage}>
          <div className={styles.frame}>
            {text.items.map((item, index) => (
              <img
                key={item.id}
                className={styles.stageShot}
                data-active={index === active}
                src={item.image}
                width={SHOT.width}
                height={SHOT.height}
                alt={index === active ? item.imageAlt : ""}
                aria-hidden={index !== active}
                loading="lazy"
                decoding="async"
              />
            ))}
          </div>
        </div>
      </div>
      <div className={styles.extras}>
        <ReportTile />
        <PaymentTile />
      </div>
    </section>
  );
}
