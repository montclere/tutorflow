import { useId } from "react";
import { Scribble } from "./Scribble";
import styles from "./RotatingBadge.module.css";

const RADIUS = 52;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function RotatingBadge({ text, className }: { text: string; className?: string }) {
  const circleId = useId();
  return (
    <div className={[styles.badge, className].filter(Boolean).join(" ")} aria-hidden="true">
      <svg className={styles.ring} viewBox="0 0 140 140" focusable="false">
        <defs>
          <path id={circleId} d={`M70 70m-${RADIUS} 0a${RADIUS} ${RADIUS} 0 1 1 ${RADIUS * 2} 0a${RADIUS} ${RADIUS} 0 1 1-${RADIUS * 2} 0`} />
        </defs>
        <circle cx="70" cy="70" r="68" className={styles.disc} />
        {/* textLength растягивает надпись ровно на окружность, чтобы начало и конец не наезжали друг на друга. */}
        <text className={styles.text} fontSize="12.5" textLength={CIRCUMFERENCE} lengthAdjust="spacing">
          <textPath href={`#${circleId}`}>{text}</textPath>
        </text>
      </svg>
      <Scribble variant="wave" tone="ink" className={styles.center} />
    </div>
  );
}
