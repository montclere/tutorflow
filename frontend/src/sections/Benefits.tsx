import { HeartHandshake, Timer, Wallet } from "lucide-react";
import { landing } from "../content/landing.ru";
import { GradientIcon } from "../shared/ui/GradientIcon";
import styles from "./Benefits.module.css";

const text = landing.benefits;
const icons = { green: Timer, orange: Wallet, pink: HeartHandshake } as const;

/** Три выгоды пастельными карточками с градиентными иконками (VIBE-2). */
export function Benefits() {
  return (
    <section className={styles.benefits} aria-label={text.label}>
      {text.items.map((item) => (
        <article key={item.title} className={`${styles.card} ${styles[item.tone]}`}>
          <GradientIcon icon={icons[item.tone]} tone={item.tone} size={52} />
          <h3 className={styles.title}>{item.title}</h3>
          <p className={styles.text}>{item.text}</p>
        </article>
      ))}
    </section>
  );
}
