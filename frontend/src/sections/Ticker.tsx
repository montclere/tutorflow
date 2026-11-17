import { landing } from "../content/landing.ru";
import styles from "./Ticker.module.css";

const { words, separator } = landing.ticker;
// Дорожка состоит из двух одинаковых половин: сдвиг на половину ширины даёт бесшовный цикл.
const half = [...words, ...words];
const track = [...half, ...half];

export function Ticker() {
  return (
    <div className={styles.ticker} aria-hidden="true">
      <div className={styles.track}>
        {track.map((word, index) => (
          <span key={index} className={styles.item}>
            <span className={styles.word}>{word}</span>
            <span className={styles.separator}>{separator}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
