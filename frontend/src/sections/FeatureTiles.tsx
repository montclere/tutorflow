import { landing } from "../content/landing.ru";
import { Lines } from "../shared/ui/Lines";
import styles from "./Features.module.css";

const text = landing.features;

export function AiTile() {
  const { ai } = text;
  return (
    <article className={`${styles.tile} ${styles.ai}`}>
      <span className={styles.aiTag}>{ai.tag}</span>
      <h3 className={styles.aiTitle}>
        <Lines lines={ai.titleLines} />
      </h3>
      <p className={styles.text}>{ai.text}</p>
      <ul className={styles.outlineChips}>
        {ai.extras.map((extra) => (
          <li key={extra}>{extra}</li>
        ))}
      </ul>
      <div className={styles.prompt} aria-hidden="true">
        <div className={styles.promptInput}>
          <span className={styles.promptText}>{ai.prompt}</span>
          <span className={styles.promptAction}>{ai.promptAction}</span>
        </div>
        <div className={styles.promptResults}>
          {ai.results.map((result, index) => (
            <span key={result} className={index === 0 ? styles.accent : undefined}>
              {result}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

export function BalanceTile() {
  const { balance } = text;
  return (
    <article className={`${styles.tile} ${styles.balance}`}>
      <h3 className={styles.title}>{balance.title}</h3>
      <ul className={styles.balanceRows}>
        {balance.rows.map((row) => (
          <li key={row.name}>
            {row.name}
            <b className={styles[row.trend]}>{row.amount}</b>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function HomeworkTile() {
  const { homework } = text;
  return (
    <article className={`${styles.tile} ${styles.mist}`}>
      <h3 className={styles.title}>{homework.title}</h3>
      <p className={styles.text}>{homework.text}</p>
      <p className={styles.chain}>
        {homework.chain.map((status, index) => (
          <span key={status} className={styles.chainItem}>
            {index > 0 && <span aria-hidden="true">{homework.arrow}</span>}
            <span className={index === homework.chain.length - 1 ? styles.chainDone : styles.chainStatus}>
              {status}
            </span>
          </span>
        ))}
      </p>
    </article>
  );
}

export function TestsTile() {
  const { tests } = text;
  return (
    <article className={`${styles.tile} ${styles.mist}`}>
      <h3 className={styles.title}>{tests.title}</h3>
      <p className={styles.score}>
        {tests.score}
        <small>{tests.total}</small>
      </p>
    </article>
  );
}

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
