import { ClipboardList, FileText, ScanText, ShieldCheck, Zap, type LucideIcon } from "lucide-react";
import { env } from "../config/env";
import { teacherRoutes } from "../config/routes";
import { landing } from "../content/landing.ru";
import { Button } from "../shared/ui/Button";
import { Lines } from "../shared/ui/Lines";
import { Tag } from "../shared/ui/Tag";
import styles from "./AiAssistant.module.css";

const text = landing.ai;
const demoHref = env.demoUrl ?? teacherRoutes.tasksCreate;

const icons: Record<(typeof text.abilities)[number]["icon"], LucideIcon> = {
  tasks: ClipboardList,
  check: ScanText,
  report: FileText,
  trainer: Zap,
};

export function AiAssistant() {
  const { chat } = text;
  return (
    <section className={styles.section} id="ai" aria-labelledby="ai-title">
      <div className={styles.top}>
        <div className={styles.copy}>
          <Tag>{text.tag}</Tag>
          <h2 id="ai-title" className={styles.title}>
            <span className={styles.hash} aria-hidden="true">
              #
            </span>
            <Lines lines={text.titleLines} />
          </h2>
          <p className={styles.lead}>{text.lead}</p>
          <Button variant="ghost" href={demoHref}>
            {text.cta}
          </Button>
        </div>

        {/* Макет похож на настоящий чат, поэтому ведёт туда, где им можно воспользоваться, — в демо-кабинет. */}
        <a className={styles.chat} href={demoHref} aria-label={text.demoLabel}>
          <span className={styles.request} aria-hidden="true">
            {chat.request}
          </span>
          <span className={styles.reply} aria-hidden="true">
            <span className={styles.author}>{chat.author}</span>
            <span>{chat.reply}</span>
          </span>
          <span className={styles.results} aria-hidden="true">
            {chat.results.map((result, index) => (
              <span key={result} className={index === 0 ? styles.accent : undefined}>
                {result}
              </span>
            ))}
          </span>
          <span className={styles.action} aria-hidden="true">
            {chat.action}
          </span>
        </a>
      </div>

      <ul className={styles.abilities}>
        {text.abilities.map((ability) => {
          const Icon = icons[ability.icon];
          return (
            <li key={ability.title} className={styles.ability}>
              <span className={styles.icon}>
                <Icon size={22} aria-hidden="true" />
              </span>
              <h3 className={styles.abilityTitle}>{ability.title}</h3>
              <p className={styles.abilityText}>{ability.text}</p>
              <p className={styles.saves}>{ability.saves}</p>
            </li>
          );
        })}
      </ul>

      <p className={styles.trust}>
        <ShieldCheck size={20} aria-hidden="true" />
        {text.trust}
      </p>
    </section>
  );
}
