import { landing } from "../content/landing.ru";
import { GlassCard } from "../shared/ui/GlassCard";
import styles from "./Hero.module.css";

const { lessonCard, paymentCard, reminderCard } = landing.hero;

export function HeroCards() {
  return (
    <div aria-hidden="true">
      <GlassCard className={styles.lesson}>
        <span className={styles.avatar}>{lessonCard.initials}</span>
        <span>
          <b className={styles.cardTitle}>{lessonCard.name}</b>
          <small className={styles.cardNote}>{lessonCard.time}</small>
        </span>
      </GlassCard>
      <GlassCard className={styles.payment}>
        <span className={styles.money}>{paymentCard.amount}</span>
        <small className={styles.cardNote}>{paymentCard.label}</small>
      </GlassCard>
      <GlassCard className={styles.reminder}>
        <span className={styles.dot}>{reminderCard.mark}</span>
        <span>
          <b className={styles.cardTitle}>{reminderCard.title}</b>
          <small className={styles.cardNote}>{reminderCard.channel}</small>
        </span>
      </GlassCard>
    </div>
  );
}
