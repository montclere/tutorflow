import { landing } from "../content/landing.ru";
import { Object3D } from "../shared/decor/Object3D";
import { Scribble } from "../shared/decor/Scribble";
import { Tag } from "../shared/ui/Tag";
import { Phone } from "./Phone";
import styles from "./Telegram.module.css";

const text = landing.telegram;

export function Telegram() {
  return (
    <section className={styles.section} id="tg" aria-labelledby="tg-title">
      <div className={styles.copy}>
        <Tag>{text.tag}</Tag>
        <h2 id="tg-title" className={styles.title}>
          {text.title}
        </h2>
        <p className={styles.lead}>{text.lead}</p>
      </div>
      <Scribble variant="curl" tone="blue" arrow className={styles.curl} />
      <Object3D name="plane" className={styles.plane} />
      <Phone />
    </section>
  );
}
