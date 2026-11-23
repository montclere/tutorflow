import { landing } from "../content/landing.ru";
import styles from "./Features.module.css";

const text = landing.features;

export function ReportTile() {
  const { report } = text;
  return (
    <article className={`${styles.tile} ${styles.outlined}`}>
      <h3 className={styles.title}>{report.title}</h3>
      <ul className={styles.report}>
        {report.items.map((item) => (
          <li key={item.label}>
            {item.label} {item.value && <b>{item.value}</b>}
          </li>
        ))}
      </ul>
    </article>
  );
}

export function PaymentTile() {
  const { payment } = text;
  return (
    <article className={`${styles.tile} ${styles.dark}`}>
      <h3 className={styles.title}>{payment.title}</h3>
      <ul className={styles.payment}>
        {payment.items.map((item, index) => (
          <li key={item} className={index === 0 ? styles.accent : undefined}>
            {item}
          </li>
        ))}
      </ul>
    </article>
  );
}
